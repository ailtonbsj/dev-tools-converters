import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToPascalFieldJava, columnToTypeJava, Dialect, snakeToCamelCase } from "../module-buillders";

export async function buildMyBatisDAOFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const entityNameCamel = snakeToCamelCase(schema.table.replace('tb_', ''));
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);
  const notPrimaries = columns.filter(col => !col.isPrimary);
  const maxColLength = columns.reduce((prev, curr) => Math.max(curr.column.length, prev), 0);
  const results = columns.map(col => {
    const field = columnToFieldJava(col.column);
    const space = ''.padStart(maxColLength - field.length - 1);
    return `@Result(property = "${field}",${space}column = "${col.column}")`;
  });
  const aliases = columns.map(col => `${col.column.padEnd(maxColLength, ' ')} ${columnToFieldJava(col.column)}`);
  const primariesPredicate = primaries.length === 1 ?
    primaries.map(p => `${p.column} = #{id}`) :
    primaries.map(p => `${p.column} = #{${columnToFieldJava(p.column)}}`);
  const primariesField = primaries.length === 1 ?
    primaries.map(p => `${columnToTypeJava(p, dialect) } id`) :
    primaries.map(p => `${columnToTypeJava(p, dialect) } ${columnToFieldJava(p.column)}`);
  const insertPredicate = columns.map(col => `#{${columnToFieldJava(col.column)}}`);
  const updatePredicate = notPrimaries.map(col => {
    const space = ''.padStart(maxColLength - col.column.length + 1);
    return `${col.column}${space}= #{${columnToFieldJava(col.column)}}`;
  });
  const andClauses = columns.map(col => {
    const strFragment = columnToTypeJava(col, dialect) === 'String' ? ` && !example.get${columnToPascalFieldJava(col.column)}().isBlank()` : '';
    return `and("e.${col.column} = #{example.${columnToFieldJava(col.column)}}", example.get${columnToPascalFieldJava(col.column)}() != null${strFragment})`;
  });
  const fieldToColumnMap = columns.map(col => {
    const field = columnToFieldJava(col.column);
    const space = ''.padStart(maxColLength - field.length - 2);
    return `entry("${field}",${space}"e.${col.column}")`;
  });

  let findByExamplePaginatedAndSortedSQL;
  if(dialect === 'oracle') {
    findByExamplePaginatedAndSortedSQL = `select * from (
            select row_.*, rownum rownum_ from (

              select e.* from ${schema.schema}.${schema.table} e
              %s
              order by
                %s

            ) row_
            where
              rownum <= #{pageable.offset} + #{pageable.pageSize}
          )
          where
            rownum_ > #{pageable.offset}`;
  } else {
    findByExamplePaginatedAndSortedSQL = `select e.* from ${schema.schema}.${schema.table} e
          %s
          order by
            %s
          limit #{pageable.offset} + #{pageable.pageSize}
          offset #{pageable.offset}`;
  }

  let daoTemplate = `
import org.apache.ibatis.annotations.*;
import org.springframework.data.domain.Pageable;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.*;
import static java.util.Map.entry;
import static org.springframework.http.HttpStatus.BAD_REQUEST;

@Mapper
public interface ${moduleName}DAO {

    @Results(id = "${entityNameCamel}ResultMap", value = {
      ${results.join(',\n      ')}
    })
    @Select("select * from ${schema.schema}.${schema.table} where ${primariesPredicate.join(', ')}")
    Optional<${moduleName}> findById(${primariesField.join(', ')});

    @Select("""
    select
      ${aliases.join(',\n      ')}
    from
      ${schema.schema}.${schema.table}
    """)
    List<${moduleName}> findAll();

    @Insert("""
      insert into ${schema.schema}.${schema.table} values (
        ${insertPredicate.join(', ')}
      )
    """)
    int insert(${moduleName} model);

    @Update("""
      update ${schema.schema}.${schema.table} set
        ${updatePredicate.join(',\n        ')}
      where
        ${primariesPredicate.join(', ')}
    """)
    int update(${moduleName} model);

    @Delete("delete from ${schema.schema}.${schema.table} where ${primariesPredicate.join(', ')}")
    boolean deleteById(${primariesField.join(', ')});

    @Select("""
    select
      ${aliases.join(',\n      ')}
    from
      ${schema.schema}.${schema.table}
    where
      (coalesce(#{keyword}, '') = '' or (
        id like upper('%' || #{keyword} || '%')
      ))
    """)
    List<${moduleName}> findByKeyword(String keyword);

    @ResultMap("${entityNameCamel}ResultMap")
    @SelectProvider(type = SQLProvider.class,  method = "findByExamplePaginatedAndSorted")
    List<${moduleName}> findByExamplePaginatedAndSorted(${moduleName} example, Pageable pageable);

    @SelectProvider(type = SQLProvider.class,  method = "countByExample")
    Long countByExample(@Param("example") ${moduleName} example);

    class SQLProvider {

      public String findByExamplePaginatedAndSorted(${moduleName} example, Pageable pageable) {
        return """
          ${findByExamplePaginatedAndSortedSQL}
        """.formatted(buildWhere(example), buildOrderBy(pageable));
      }

      public String countByExample(${moduleName} example) {
          return """
              select count(1) from ${schema.schema}.${schema.table} e
              %s
          """.formatted(buildWhere(example));
      }

      private String buildWhere(${moduleName} example) {
          var clauses = Stream.of(
              ${andClauses.join(',\n              ')}
          ).filter(Objects::nonNull).collect(Collectors.toList());
          if(!clauses.isEmpty()) {
              clauses.set(0, clauses.getFirst().replaceAll("(?i)^and|^or", ""));
              clauses.addFirst("where");
          }
          return clauses.isEmpty() ? "" : String.join("\\n", clauses);
      }

      private String and(String sql, boolean condition) {
          return condition ? "and " + sql : null;
      }

      private String buildOrderBy(Pageable pageable) {
          if (pageable.getSort().isUnsorted()) return FIELDMAP.get("id") + "asc";
          return pageable.getSort().stream().map(order -> {
              String column = FIELDMAP.get(order.getProperty());
              if (column == null) throw new ResponseStatusException(BAD_REQUEST, "Campo de ordenamento inválido." );
              return column + " " + order.getDirection().name();
          }).collect(Collectors.joining(", "));
      }

      private static final Map<String, String> FIELDMAP = Map.ofEntries(
        ${fieldToColumnMap.join(',\n        ')}
      );

    }
}
  `;

  return daoTemplate;
}
