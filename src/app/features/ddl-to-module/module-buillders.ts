import { PgParser } from '@supabase/pg-parser';
import { DatabaseTable, TableColunm } from "./database-table.model";
import { plural } from '@umatch/pluralize-ptbr';

export type Dialect = 'postgresql' | 'oracle';

export function capitalLetter(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function decapitalLetter(str: string) {
  return str.charAt(0).toLocaleLowerCase() + str.slice(1);
}

export function snakeToCamelCase(snake: string) {
  return snake.split('_').map((t, i) => i === 0 ? decapitalLetter(t) : capitalLetter(t)).join('');
}

export function snakeToPascalCase(snake: string) {
  return snake.split('_').map(t => capitalLetter(t)).join('');
}

export function pascalToKebabCase(pascal: string) {
  return pascal.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(' ', '-').toLowerCase();
}

export function pascalToSnakeCase(pascal: string) {
  return pascal.replace(/([a-z])([A-Z])/g, '$1 $2').replaceAll(' ', '_').toLowerCase();
}

export function normalizeColumnOfTable(snakeColunm: string) {
  let res = snakeColunm.toLowerCase().replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^tp_|^hr_|^vr_|^vl_/g,'') +
    ((/^cd_/i).test(snakeColunm.toLowerCase()) ? 'Id' : '');
		return snakeColunm.toLowerCase().includes('ci_') ? 'id' : res;
}

export function columnToFieldJava(columnOfTable: string) {
  return snakeToCamelCase(normalizeColumnOfTable(columnOfTable));
}

export function columnToPascalFieldJava(columnOfTable: string) {
  return snakeToPascalCase(normalizeColumnOfTable(columnOfTable));
}

export function columnToTypeJava(col: TableColunm, dialect: Dialect) {
  let columnType = 'UNKNOWN_TYPE';
  // let len = '';
  switch (col.type.toLowerCase()) {
    case 'varchar2':
    case 'varchar':
    case 'bpchar':
    case 'text':
      columnType = col.len === 1 ? 'Character' : 'String';
      // len = col.len ? `, length = ${col.len}` : '';
      break;
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'number':
      if(col.scale > 0) {
        columnType = 'BigDecimal';
        // len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
      } else if(col.len > 18) {
        columnType = 'BigDecimal';
        // len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
      }
      else if(col.len > 9) columnType = 'Long';
      else columnType = 'Integer';
      break;
    case 'bigserial':
    case 'bigint':
    case 'serial8':
    case 'int8':
      columnType = 'Long';
      break;
    case 'serial':
    case 'smallserial':
    case 'integer':
    case 'smallint':
    case 'serial4':
    case 'int4':
      columnType = 'Integer';
      break;
    case 'timestamp':
      columnType = 'LocalDateTime';
      break;
    case 'date':
      columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
      break;
    case 'bool':
    case 'boolean':
      columnType = 'Boolean';
      break;
    default:
      console.log(col.type);
  }
  return columnType;
}

export function columnToTypeTypeScript(col: TableColunm, dialect: Dialect) {
  let columnType = 'UNKNOWN_TYPE';
  switch (col.type.toLowerCase()) {
    case 'varchar2':
    case 'varchar':
    case 'bpchar':
    case 'text':
      columnType = 'string';
      break;
    case 'numeric':
    case 'real':
    case 'double precision':
    case 'number':
      columnType = col.len > 16 ? 'string' : 'number';
      break;
    case 'bigserial':
    case 'bigint':
    case 'serial8':
    case 'int8':
      columnType = 'number';
      break;
    case 'serial':
    case 'smallserial':
    case 'integer':
    case 'smallint':
    case 'serial4':
    case 'int4':
      columnType = 'number';
      break;
    case 'timestamp':
      columnType = 'Date';
      break;
    case 'date':
      columnType = 'Date';
      break;
    case 'bool':
    case 'boolean':
      columnType = 'boolean';
      break;
    default:
      console.log(col.type);
  }
  return columnType;
}

export async function sqlCreateTableToAST(ddl: string): Promise<DatabaseTable> {
  const parser = new PgParser({ version: 17 });
	const { tree } = await parser.parse(ddl);
	if(tree == null || tree.stmts == null || tree.stmts[0].stmt == null) {
    window.alert('Falha ao converter SQL. Verifique se é um DDL Create válido.');
    return {} as DatabaseTable;
  }
	const createStmt = (tree.stmts[0].stmt as any).CreateStmt;
	const tableElts = createStmt.tableElts;

	const schema = {} as DatabaseTable;
	schema.schema = createStmt.relation.schemaname.toLowerCase();
	schema.table = createStmt.relation.relname.toLowerCase();
	schema.columns = [];

	for(const elt of tableElts) {
		if(elt.ColumnDef) {
			const columnDef = elt.ColumnDef;

			let schemaCol = {} as TableColunm;
			schemaCol.isNullable = true;
			schemaCol.isUnique = false;
			schemaCol.isPrimary = false;
			schemaCol.column =  columnDef.colname.toLowerCase();
			schemaCol.type = columnDef.typeName.names.at(-1).String.sval;
			if((/serial/i).test(schemaCol.type)) schemaCol.autoincrement = true;

			if(columnDef.typeName.typmods) {
				schemaCol.len = columnDef.typeName.typmods[0].A_Const.ival.ival;
				schemaCol.scale = columnDef.typeName.typmods[1] ? columnDef.typeName.typmods[1].A_Const.ival.ival : 0;
			}
			if(columnDef.constraints) {
				for(const constraint of columnDef.constraints) {
					if(constraint.Constraint.contype === 'CONSTR_NOTNULL') schemaCol.isNullable = false;
          if(constraint.Constraint.contype === 'CONSTR_PRIMARY') schemaCol.isPrimary = true;
				}
			}
			schema.columns.push(schemaCol);
		} else if (elt.Constraint) {
			if(elt.Constraint.contype === 'CONSTR_UNIQUE') {
				for(const key of elt.Constraint.keys) {
					const schemaCol = schema.columns.find((c: any) => c.column === key.String.sval.toLowerCase());
					if(schemaCol) schemaCol.isUnique = true;
				}
			} else if(elt.Constraint.contype === 'CONSTR_PRIMARY') {
				for(const key of elt.Constraint.keys) {
					const schemaCol = schema.columns.find((c: any) => c.column === key.String.sval.toLowerCase());
					if(schemaCol) {
						schemaCol.isPrimary = true;
						schemaCol.isNullable = false;
						schemaCol.isUnique = true;
					}
				}
			} else if(elt.Constraint.contype === 'CONSTR_FOREIGN') {
				for(const attr of elt.Constraint.fk_attrs) {
					const schemaCol = schema.columns.find((c: any) => c.column === attr.String.sval.toLowerCase());
					const refTable = elt.Constraint.pktable;
					if(schemaCol)
            schemaCol.references = refTable.schemaname + '.' + refTable.relname + '(' + elt.Constraint.pk_attrs.map((a: any) => a.String.sval).join(',') + ')';
				}
			} else if(elt.Constraint.contype === 'CONSTR_CHECK') { // Oracle constraints
				const rawExpr = elt.Constraint.raw_expr;
				if(rawExpr.NullTest && rawExpr.NullTest.nulltesttype === 'IS_NOT_NULL') {
					if(rawExpr.NullTest.arg.ColumnRef) {
						const col = rawExpr.NullTest.arg.ColumnRef.fields[0].String.sval.toLowerCase();
						const schemaCol = schema.columns.find((c: any) => c.column.toLowerCase() === col);
						if(schemaCol) schemaCol.isNullable = false;
					} else window.alert('Simplifique as constraints mais complexas!');
				} else if(rawExpr.A_Expr && rawExpr.A_Expr.kind === 'AEXPR_IN') {
					const col = rawExpr.A_Expr.lexpr.ColumnRef.fields[0].String.sval.toLowerCase();
					const schemaCol = schema.columns.find((c: any) => c.column.toLowerCase() === col);
					const enumObj = rawExpr.A_Expr.rexpr.List.items.map((i: any) => i.A_Const.sval.sval);
					if(schemaCol && enumObj instanceof Array) schemaCol.allowValues = [...enumObj];
				} else if(rawExpr.A_Expr && rawExpr.A_Expr.kind === 'AEXPR_OP') {
					window.alert('Constraints de operações não são analisadas!');
				} else {
					console.log(elt.Constraint)
				}
			} else {
				console.log(elt.Constraint)
			}
		}
	}

  const commentColStmts = (tree.stmts as [any])
    .filter(stmtItem => stmtItem.stmt != null && stmtItem.stmt.CommentStmt != null && stmtItem.stmt.CommentStmt.objtype === 'OBJECT_COLUMN').map(s => s.stmt.CommentStmt);
  commentColStmts.map(com => {
    const comment = com.comment;
    const col = com.object.List.items[2].String.sval;
    const schemaCol = schema.columns.find(i => i.column === col);
    console.log(schemaCol);
    if(schemaCol) schemaCol.comment = comment;
    if(schemaCol && comment.includes('Label:')) schemaCol.label = comment.split('Label:')[1].trim();
  })

  return schema;
}

export async function buildEntityJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
	let entityJPA = `
import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "${schema.table}", schema = "${schema.schema}")
@Getter
@Setter
@NoArgsConstructor
public class ${moduleName} implements Serializable {\n\n`;

	for(const col of schema.columns) {
		const unique = col.isUnique ? `, unique = true` : '';
		let normalizedColunm = col.column.toLowerCase()
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^tp_|^hr_|^vr_|^vl_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
		normalizedColunm = col.column.toLowerCase().includes('ci_') ? 'id' : normalizedColunm;
		const columnName = snakeToCamelCase(normalizedColunm);
		let columnType = 'UNKNOWN_TYPE';
		let len = '';
		switch (col.type.toLowerCase()) {
			case 'varchar2':
			case 'varchar':
			case 'bpchar':
			case 'text':
				columnType = col.len === 1 ? 'Character' : 'String';
				len = col.len ? `, length = ${col.len}` : '';
				break;
			case 'numeric':
			case 'real':
			case 'double precision':
			case 'number':
				if(col.scale > 0) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				} else if(col.len > 18) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				}
				else if(col.len > 9) columnType = 'Long';
				else columnType = 'Integer';
				break;
			case 'bigserial':
			case 'bigint':
			case 'serial8':
			case 'int8':
				columnType = 'Long';
				break;
			case 'serial':
			case 'smallserial':
			case 'integer':
			case 'smallint':
			case 'serial4':
			case 'int4':
				columnType = 'Integer';
				break;
			case 'timestamp':
				columnType = 'LocalDateTime';
				break;
			case 'date':
				columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
				break;
			case 'bool':
			case 'boolean':
				columnType = 'Boolean';
				break;
			default:
				console.log(col.type);
		}
		const refs = col.references ? `\t// References: ${col.references}\n` : '';
		const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
		const primarykey = col.isPrimary ? `\t@Id\n` : '';
		const autoincrement = col.autoincrement ? `\t@GeneratedValue(strategy = GenerationType.IDENTITY)\n` : '';
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

		let colStr = `${label}${refs}${enumVals}${primarykey}${autoincrement}`;
		colStr += `\t@Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		colStr += `\tprivate ${columnType} ${columnName};\n\n`;

		entityJPA += colStr;
	}

	entityJPA += '}';

  return entityJPA;
}

export async function buildRepositoryJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkType = columnToTypeJava(primaries[0], dialect);
  return `
import org.springframework.data.jpa.repository.JpaRepository;

public interface ${moduleName}Repository extends JpaRepository<${moduleName}, ${pkType}> {
}
`;

}

export async function buildEntityMyBatisFromDdl(schema: DatabaseTable, dialect: Dialect): Promise<string> {

	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
	let entity = `
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ${entityName} implements Serializable {\n\n`;

	for(const col of schema.columns) {
		const unique = col.isUnique ? `, unique = true` : '';
		let normalizedColunm = col.column.toLowerCase()
			.replaceAll(/^ci_|^cd_|^nr_|^nm_|^dt_|^ds_|^fl_|^tp_|^hr_|^vr_|^vl_/g,'') + ((/^cd_/i).test(col.column.toLowerCase()) ? 'Id' : '');
		normalizedColunm = col.column.toLowerCase().includes('ci_') ? 'id' : normalizedColunm;
		const columnName = snakeToCamelCase(normalizedColunm);
		let columnType = 'UNKNOWN_TYPE';
		let len = '';
		switch (col.type.toLowerCase()) {
			case 'varchar2':
			case 'varchar':
			case 'bpchar':
			case 'text':
				columnType = col.len === 1 ? 'Character' : 'String';
				len = col.len ? `, length = ${col.len}` : '';
				break;
			case 'numeric':
			case 'real':
			case 'double precision':
			case 'number':
				if(col.scale > 0) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				} else if(col.len > 18) {
					columnType = 'BigDecimal';
					len = col.len ? `, precision = ${col.len}, scale = ${col.scale}`: '';
				}
				else if(col.len > 9) columnType = 'Long';
				else columnType = 'Integer';
				break;
			case 'bigserial':
			case 'bigint':
			case 'serial8':
			case 'int8':
				columnType = 'Long';
				break;
			case 'serial':
			case 'smallserial':
			case 'integer':
			case 'smallint':
			case 'serial4':
			case 'int4':
				columnType = 'Integer';
				break;
			case 'timestamp':
				columnType = 'LocalDateTime';
				break;
			case 'date':
				columnType = dialect === 'oracle' ? 'LocalDateTime' : 'LocalDate';
				break;
			case 'bool':
			case 'boolean':
				columnType = 'Boolean';
				break;
			default:
				console.log(col.type);
		}
		const refs = col.references ? `\t// References: ${col.references}\n` : '';
		const enumVals = col.allowValues ? `\t// Enum: ${col.allowValues.join(', ')}\n` : '';
		const primarykey = col.isPrimary ? `\t// Primary Key\n` : '';
    const label = col.label != null && col.label !== '' ? `\t/* ${col.label} */\n` : '';

		let colStr = `${label}${refs}${enumVals}${primarykey}`;
    colStr += `\t// Column(name = "${col.column}", nullable = ${col.isNullable}${len}${unique})\n`;
		colStr += `\tprivate ${columnType} ${columnName};\n\n`;

		entity += colStr;
	}

	entity += '}';

  return entity;
}

export async function buildMyBatisDAOFromDdl(schema: DatabaseTable, dialect: Dialect): Promise<string> {
	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
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
          )
          where
            rownum_ <= #{pageable.offset} + #{pageable.pageSize} and
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
public interface ${entityName}DAO {

    @Results(id = "${entityNameCamel}ResultMap", value = {
      ${results.join(',\n      ')}
    })
    @Select("select * from ${schema.schema}.${schema.table} where ${primariesPredicate.join(', ')}")
    Optional<${entityName}> findById(${primariesField.join(', ')});

    @Select("""
    select
      ${aliases.join(',\n      ')}
    from
      ${schema.schema}.${schema.table}
    """)
    List<${entityName}> findAll();

    @Insert("""
      insert into ${schema.schema}.${schema.table} values (
        ${insertPredicate.join(', ')}
      )
    """)
    int insert(${entityName} model);

    @Update("""
      update ${schema.schema}.${schema.table} set
        ${updatePredicate.join(',\n        ')}
      where
        ${primariesPredicate.join(', ')}
    """)
    int update(${entityName} model);

    @Delete("delete from ${schema.schema}.${schema.table} where ${primariesPredicate.join(', ')}")
    boolean deleteById(${primariesField.join(', ')});

    @ResultMap("${entityNameCamel}ResultMap")
    @SelectProvider(type = SQLProvider.class,  method = "findByExamplePaginatedAndSorted")
    List<${entityName}> findByExamplePaginatedAndSorted(${entityName} example, Pageable pageable);

    @SelectProvider(type = SQLProvider.class,  method = "countByExample")
    Long countByExample(@Param("example") ${entityName} example);

    class SQLProvider {

      public String findByExamplePaginatedAndSorted(${entityName} example, Pageable pageable) {
        return """
          ${findByExamplePaginatedAndSortedSQL}
        """.formatted(buildWhere(example), buildOrderBy(pageable));
      }

      public String countByExample(${entityName} example) {
          return """
              select count(1) from ${schema.schema}.${schema.table} e
              %s
          """.formatted(buildWhere(example));
      }

      private String buildWhere(${entityName} example) {
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

export async function buildServiceFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkId = columnToFieldJava(primaries[0].column);
  const pkType = columnToTypeJava(primaries[0], dialect);

  return `
import org.springframework.data.domain.*;
import java.util.*;

public interface ${moduleName}Service {

    Optional<${moduleName}DTO> show(${pkType} ${pkId});

    List<${moduleName}DTO> index();

    void create(${moduleName}DTO model);

    void update(${pkType} ${pkId}, ${moduleName}DTO model);

    boolean destroy(${pkType} ${pkId});

    Page<${moduleName}DTO> filter(${moduleName}DTO example, Pageable pageable);

}
`;

}

export async function buildSpringDTOFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
	const entityName = snakeToPascalCase(schema.table.replace('tb_', ''));
  const columns = schema.columns;

  const properties = columns.map(col => {
    const type = columnToTypeJava(col, dialect);
    const field = columnToFieldJava(col.column);
    const label = col.label != null && col.label !== '' ? col.label : field;
    const pkValid = col.isPrimary ? `@Null(message = "O campo ${label} precisa está vazio.")\n  ` : '';
    const notBlankOrNull = ['String'].includes(type) ?
      `@NotBlank(message = "O campo ${label} não pode ser nulo ou em branco.")` : `@NotNull(message = "O campo ${label} não pode ser nulo.")`;
    const notNullValid = !col.isNullable ? `${notBlankOrNull}\n  ` : '';
    const sizeValid = col.len > 0 && ['String'].includes(type) && pkValid === '' ?
      `@Size(max = ${col.len}, message = "O campo ${label} aceita no máximo ${col.len} caracteres.")\n  ` : '';
    const scaleMessage = col.scale > 0 ? ` e ${col.scale} decimais.` : '.';
    const digitValid = col.len > 0 && ['Integer', 'Long', 'BigDecimal', 'Double'].includes(type) && pkValid === '' ?
      `@Digits(integer = ${col.len}, fraction = ${col.scale}, message = "O campo ${label} só permite ${col.len} digitos inteiros${scaleMessage}")\n  ` : '';
    const labelComment = col.label != null && col.label !== '' ? `/* ${col.label} */\n  ` : '';

    return `${labelComment}${pkValid}${notNullValid}${sizeValid}${digitValid}private ${type} ${field};`;
  });


  return `

import jakarta.validation.constraints.*;
import lombok.*;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
public class ${moduleName}DTO implements Serializable {

  ${properties.join('\n\n  ')}

}
`;

}

export async function buildMapperFromDdl(moduleName: string, ddl: string): Promise<string> {

  return `
import org.mapstruct.Mapper;
import org.mapstruct.MappingConstants;
import java.util.List;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING, uses = {
  GenericMapper.class
})
public interface ${moduleName}Mapper {
    ${moduleName}DTO toDto(${moduleName} domain);
    List<${moduleName}DTO> toDto(List<${moduleName}> domain);
    ${moduleName} toDomain(${moduleName}DTO dto);
    List<${moduleName}> toDomain(List<${moduleName}DTO> dto);
}`;

}

export async function buildResourceFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const pluralKebabName = plural(pascalToKebabCase(moduleName));
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkId = columnToFieldJava(primaries[0].column);
  const pkType = columnToTypeJava(primaries[0], dialect);

  const moduleNameSnakeUp = pascalToSnakeCase(moduleName).toUpperCase();

  return `
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

import static org.springframework.http.HttpStatus.CREATED;

@Tag(name = "${humanName}")
@RestController
@RequestMapping("${pluralKebabName}")
@RequiredArgsConstructor
public class ${moduleName}Resource {

    private final ${moduleName}Service service;

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping("{id}")
    @Operation(summary = "Obtem um registro pelo ID")
    public ResponseEntity<${moduleName}DTO> show(@PathVariable ${pkType} id) {
        return service.show(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping
    @ResponseStatus(value = HttpStatus.OK)
    @Operation(summary = "Lista todos registros")
    public List<${moduleName}DTO> index() {
        return service.index();
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_INSERIR')")
    @PostMapping
    @Operation(summary = "Cria novo registro")
    public ResponseEntity<Void> create(@Valid @RequestBody ${moduleName}DTO dto) {
        service.create(dto);
        return ResponseEntity.status(CREATED).build();
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_EDITAR')")
    @PutMapping("{id}")
    @Operation(summary = "Atualiza um registro por completo")
    public ResponseEntity<Void> update(@PathVariable ${pkType} id, @Valid @RequestBody ${moduleName}DTO dto) {
        service.update(id, dto);
        return ResponseEntity.ok().build();
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_REMOVER')")
    @DeleteMapping("{id}")
    @Operation(summary = "Remove um registro pelo ID")
    public ResponseEntity<Void> destroy(@PathVariable ${pkType} id) {
        if (service.destroy(id)) return ResponseEntity.ok().build();
        return ResponseEntity.notFound().build();
    }

    //@PreAuthorize("hasRole('${moduleNameSnakeUp}_VER')")
    @GetMapping("filter")
    @ResponseStatus(value = HttpStatus.OK)
    @Operation(summary = "Filtra registros por exemplo")
    public Page<${moduleName}DTO> filter(
            ${moduleName}DTO example,
            @RequestParam(defaultValue = "0") Integer pageNumber,
            @RequestParam(defaultValue = "10") Integer pageSize,
            @RequestParam(defaultValue = "asc") String[] directions,
            @RequestParam(defaultValue = "id") String[] sortProps) {
        var sort = Util.directionPropsToOrders(directions, sortProps);
        var pageable = PageRequest.of(pageNumber, pageSize, sort);
        return service.filter(example, pageable);
    }

}
`;
}

export async function buildImplementationJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkId = columnToFieldJava(primaries[0].column);
  const pkType = columnToTypeJava(primaries[0], dialect);

  return `
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Example;
import org.springframework.data.domain.ExampleMatcher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ${moduleName}ServiceImpl implements ${moduleName}Service {

    private final ${moduleName}Repository repository;
    private final ${moduleName}Mapper mapper;

    @Override
    public Optional<${moduleName}DTO> show(${pkType} id) {
        return repository.findById(id).map(mapper::toDto);
    }

    @Override
    public List<${moduleName}DTO> index() {
        return mapper.toDto(repository.findAll());
    }

    @Override
    public void create(${moduleName}DTO dto) {
        try {
            var domain = mapper.toDomain(dto);
            repository.save(domain);
        } catch (Exception e) {
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falha ao salvar.");
        }
    }

    @Override
    public void update(${pkType} id, ${moduleName}DTO dto) {
        try {
            var domain = mapper.toDomain(dto);
            domain.setId(id);
            repository.save(domain);
        }  catch (Exception e) {
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falha ao atualizar.");
        }
    }

    @Override
    public boolean destroy(${pkType} id) {
        try {
            if(repository.findById(id).isEmpty()) return false;
            repository.deleteById(id);
            return true;
        } catch (Exception e) {
            log.warn("{}", e.getCause().getMessage());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Falha ao remover.");
        }
    }

    @Override
    public Page<${moduleName}DTO> filter(${moduleName}DTO example, Pageable pageable) {
        var domain = mapper.toDomain(example);
        ExampleMatcher matcher = ExampleMatcher.matching().withIgnoreCase()
            .withStringMatcher(ExampleMatcher.StringMatcher.CONTAINING);
        var sample = Example.of(domain, matcher);
        var result = repository.findAll(sample, pageable);
        return result.map(mapper::toDto);
    }
}
`;
}

export async function buildTestImplJPAFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkId = columnToFieldJava(primaries[0].column);
  const pkType = columnToTypeJava(primaries[0], dialect);

  const colStr = columns.filter(col => !col.isPrimary).find(col => columnToTypeJava(col, dialect) === 'String') ?? <TableColunm>{ column: 'field' };
  const fieldStr = columnToFieldJava(colStr.column);
  const fieldStrPascal = capitalLetter(fieldStr);

  return `
import org.instancio.Instancio;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.*;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.Collections;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.instancio.Select.field;
import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class ${moduleName}ServiceImplTest {

    @InjectMocks
    ${moduleName}Service service;

    @Mock
    ${moduleName}Repository repository;

    @Mock
    ${moduleName}Mapper mapper;

    @Test
    void showDeveExibirNenhumaEntidade() {
        when(repository.findById(any())).thenReturn(Optional.empty());

        var response = service.show(any());

        verify(repository, times(1)).findById(any());
        verify(mapper, times(0)).toDto(any(${moduleName}.class));
        assertTrue(response.isEmpty());
    }

    @Test
    void showDeveExibirUmaEntidade() {
        var entity = Instancio.create(${moduleName}.class);
        var dto = Instancio.create(${moduleName}DTO.class);

        when(repository.findById(any())).thenReturn(Optional.of(entity));
        when(mapper.toDto(any(${moduleName}.class))).thenReturn(dto);

        var response = service.show(any());

        verify(repository, times(1)).findById(any());
        verify(mapper, times(1)).toDto(any(${moduleName}.class));
        assertNotNull(response.orElse(null));
        assertThat(response).isPresent().get().usingRecursiveComparison().isEqualTo(dto);
    }

    @Test
    void indexDeveListarNenhumaEntidade() {
        when(repository.findAll()).thenReturn(Collections.emptyList());
        when(mapper.toDto(anyList())).thenReturn(Collections.emptyList());

        var result = service.index();

        verify(repository, times(1)).findAll();
        verify(mapper, times(1)).toDto(anyList());
        assertEquals(0, result.size());
    }

    @Test
    void indexDeveListarEntidades() {
        int listSize = 3;
        var list = Instancio.ofList(${moduleName}.class).size(listSize).create();
        var dtoList = Instancio.ofList(${moduleName}DTO.class).size(listSize).create();

        when(repository.findAll()).thenReturn(list);
        when(mapper.toDto(anyList())).thenReturn(dtoList);

        var result = service.index();

        verify(repository, times(1)).findAll();
        verify(mapper, times(1)).toDto(anyList());
        assertEquals(listSize, result.size());
        assertThat(result.get(1)).usingRecursiveComparison().isEqualTo(dtoList.get(1));
    }

    @Test
    void createDeveCriarUmaEntidade() {
        var dto = Instancio.create(${moduleName}DTO.class);
        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);

        service.create(dto);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
    }

    @Test
    void createDeveLancarExcecao() {
        var dto = Instancio.create(${moduleName}DTO.class);

        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);
        when(repository.save(any())).thenThrow(
                new DataIntegrityViolationException("", new SQLException("")));

        var ex = assertThrows(ResponseStatusException.class, () -> service.create(dto));

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void updateDeveAtualizarUmaEntidade() {
        var dto = Instancio.create(${moduleName}DTO.class);
        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);

        service.update(any(), dto);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
    }

    @Test
    void updateDeveLancarExcecao() {
        var id = Instancio.create(${pkType}.class);
        var dto = Instancio.create(${moduleName}DTO.class);
        var entity = Instancio.create(${moduleName}.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(entity);
        when(repository.save(any())).thenThrow(
                new DataIntegrityViolationException("", new SQLException("")));

        var ex = assertThrows(ResponseStatusException.class, () -> service.update(id, dto));

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).save(any());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void destroyDeveRemoverUmaEntidade() {
        var entity = Instancio.create(${moduleName}.class);

        when(repository.findById(any())).thenReturn(Optional.of(entity));

        var result = service.destroy(any());

        verify(repository, times(1)).findById(any());
        verify(repository, times(1)).deleteById(any());
        assertTrue(result);
    }

    @Test
    void destroyDeveRetornarFalso() {
        when(repository.findById(any())).thenReturn(Optional.empty());

        var result = service.destroy(any());

        verify(repository, times(1)).findById(any());
        verify(repository, times(0)).deleteById(any());
        assertFalse(result);
    }

    @Test
    void destroyDeveLancarExcecao() {
        var id = Instancio.create(${pkType}.class);
        var entity = Instancio.create(${moduleName}.class);

        when(repository.findById(any())).thenReturn(Optional.of(entity));
        doThrow(new DataIntegrityViolationException("", new SQLException("")))
            .when(repository).deleteById(any());

        var ex = assertThrows(ResponseStatusException.class, () -> service.destroy(id));

        verify(repository, times(1)).findById(any());
        verify(repository, times(1)).deleteById(any());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void filterDevePaginarEntidades() {
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var domain = Instancio.createBlank(${moduleName}.class);
        var list = Instancio.ofList(${moduleName}.class).size(pageSize).create();
        var page = new PageImpl<>(list, pageable, total);
        var pageItem = Instancio.create(${moduleName}DTO.class);

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(domain);
        when(repository.findAll(any(), any(Pageable.class))).thenReturn(page);
        when(mapper.toDto(any(${moduleName}.class))).thenReturn(pageItem);

        var result = service.filter(dto, pageable);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).findAll(any(), any(Pageable.class));
        verify(mapper, times(pageSize)).toDto(any(${moduleName}.class));
        assertEquals(pageSize, result.getContent().size());
        assertEquals(total, result.getTotalElements());
        assertNotNull(result.getContent().getFirst());
    }

    @Test
    void filterDeveConsultarPorExemplo() {
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        final String QUERY = "Example";
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        dto.set${fieldStrPascal}(QUERY);
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var domain = Instancio.createBlank(${moduleName}.class);
        domain.set${fieldStrPascal}(QUERY);
        var list = Instancio.ofList(${moduleName}.class).size(pageSize).create();
        var page = new PageImpl<>(list, pageable, total);
        var pageItem = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::get${fieldStrPascal}), QUERY).create();
        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(domain);
        when(repository.findAll(any(), any(Pageable.class))).thenReturn(page);
        when(mapper.toDto(any(${moduleName}.class))).thenReturn(pageItem);

        var result = service.filter(dto, pageable);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).findAll(any(), any(Pageable.class));
        verify(mapper, times(pageSize)).toDto(any(${moduleName}.class));
        assertEquals(pageSize, result.getContent().size());
        assertEquals(total, result.getTotalElements());
        assertNotNull(result.getContent().getFirst());
        assertThat(result.getContent()).extracting(${moduleName}DTO::get${fieldStrPascal}).containsOnly(QUERY);
    }

    @Test
    void filterDeveOrdernarEntidades() {
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        var pageable = PageRequest.of(pageNumber, pageSize, Sort.by("id").descending());
        var domain = Instancio.createBlank(${moduleName}.class);
        var item1 = Instancio.of(${moduleName}.class).set(field(${moduleName}::getId), 2${pkType === 'Long' ? 'L' : ''}).create();
        var item2 = Instancio.of(${moduleName}.class).set(field(${moduleName}::getId), 1${pkType === 'Long' ? 'L' : ''}).create();
        var page = new PageImpl<>(List.of(item1, item2), pageable, total);
        var pageItem1 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 2).create();
        var pageItem2 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 1).create();

        when(mapper.toDomain(any(${moduleName}DTO.class))).thenReturn(domain);
        when(repository.findAll(any(), any(Pageable.class))).thenReturn(page);
        when(mapper.toDto(item1)).thenReturn(pageItem1);
        when(mapper.toDto(item2)).thenReturn(pageItem2);

        var result = service.filter(dto, pageable);

        verify(mapper, times(1)).toDomain(any(${moduleName}DTO.class));
        verify(repository, times(1)).findAll(any(), any(Pageable.class));
        verify(mapper, times(pageSize)).toDto(any(${moduleName}.class));
        assertEquals(pageSize, result.getContent().size());
        assertEquals(total, result.getTotalElements());
        assertNotNull(result.getContent().getFirst());
        assertThat(result.getContent()).extracting(${moduleName}DTO::getId).containsExactly(${pkType === 'Long' ? '2L, 1L' : '2, 1'});
    }

}
`;
}

export async function buildTestResourceFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;
  const pluralKebabName = plural(pascalToKebabCase(moduleName));

  const colStr = columns.filter(col => !col.isPrimary).find(col => columnToTypeJava(col, dialect) === 'String') ?? <TableColunm>{ column: 'field' };
  const fieldStr = columnToFieldJava(colStr.column);
  const fieldStrPascal = capitalLetter(fieldStr);

  return `
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.instancio.Instancio;
import org.instancio.junit.WithSettings;
import org.instancio.settings.Keys;
import org.instancio.settings.Settings;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.assertj.MockMvcTester;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.AssertionsForInterfaceTypes.assertThat;
import static org.instancio.Select.field;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

@WebMvcTest(${moduleName}Resource.class)
@AutoConfigureMockMvc(addFilters = false)
class ${moduleName}ResourceTest {

    @Autowired
    private MockMvcTester mockMvcTester;

    @MockitoBean
    private JwtGrantedAuthoritiesConverter jwtGrantedAuthoritiesConverter;

    @MockitoBean
    private JwtAuthConverterProperties jwtAuthConverterProperties;

    @MockitoBean
    private AppProperties appProperties;

    @MockitoBean
    private HttpSecurity httpSecurity;

    @MockitoBean
    private ${moduleName}Service service;

    @WithSettings
    private final Settings validationEnabled = Settings.create().set(Keys.BEAN_VALIDATION_ENABLED, true);

    private final ObjectMapper objectMapper = JsonMapper.builder()
        .addModule(new JavaTimeModule()).disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS).build();

    @Test
    void showDeveExibirUmaEntidade() {
        var dto = Instancio.of(${moduleName}DTO.class).create();
        var id = dto.getId();

        when(service.show(id)).thenReturn(Optional.of(dto));

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}/{id}", id))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.id", val -> val.assertThat().isEqualTo(id));
        verify(service).show(id);
    }

    @Test
    void showDeveExibirNenhumaEntidade() {
        var id = 0;

        when(service.show(id)).thenReturn(Optional.empty());

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}/{id}", id))
            .hasStatus(HttpStatus.NOT_FOUND);
        verify(service).show(id);
    }

    @Test
    void indexDeveListarEntidades() {
        int size = 2;
        var list = Instancio.ofList(${moduleName}DTO.class).size(size).create();
        var id = list.getFirst().getId();

        when(service.index()).thenReturn(list);

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}"))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$", val -> val.assertThat().asArray().hasSize(size))
            .hasPathSatisfying("$[0].id", val -> val.assertThat().isEqualTo(id));
        verify(service).index();
    }

    @Test
    void indexDeveListarNenhumaEntidade() {
        when(service.index()).thenReturn(List.of());

        assertThat(mockMvcTester.get().uri("/${pluralKebabName}"))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .isEqualTo("[]");
        verify(service).index();
    }

    @Test
    void createDeveCriarUmaEntidade() throws JsonProcessingException {
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        assertThat(
                mockMvcTester.post().uri("/${pluralKebabName}")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatus(HttpStatus.CREATED)
            .body()
            .isEmpty();
        verify(service).create(any(${moduleName}DTO.class));
    }

    @Test
    void createDeveLancarExcecao() throws JsonProcessingException {
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST))
            .when(service).create(any(${moduleName}DTO.class));

        assertThat(
                mockMvcTester.post().uri("/${pluralKebabName}")
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatus(HttpStatus.BAD_REQUEST);
        verify(service).create(any(${moduleName}DTO.class));
    }

    @Test
    void updateDeveAtualizarUmaEntidade() throws JsonProcessingException {
        var id = 1;
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        assertThat(
                mockMvcTester.put().uri("/${pluralKebabName}/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatusOk()
            .body()
            .isEmpty();
        verify(service).update(eq(id), any(${moduleName}DTO.class));
    }

    @Test
    void updateDeveLancarExcecao() throws JsonProcessingException {
        var id = 1;
        var dto = Instancio.of(${moduleName}DTO.class)
          .withSettings(validationEnabled).ignore(field(${moduleName}DTO::getId)).create();
        var json = objectMapper.writeValueAsString(dto);

        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST))
            .when(service).update(any(), any(${moduleName}DTO.class));

        assertThat(
                mockMvcTester.put().uri("/${pluralKebabName}/{id}", id)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json))
            .hasStatus(HttpStatus.BAD_REQUEST);
        verify(service).update(any(), any(${moduleName}DTO.class));
    }

    @Test
    void destroyDeveRemoverUmaEntidade() {
        var id = 1;

        when(service.destroy(id)).thenReturn(true);

        assertThat(
                mockMvcTester.delete().uri("/${pluralKebabName}/{id}", id))
            .hasStatusOk()
            .body()
            .isEmpty();
        verify(service).destroy(id);
    }

    @Test
    void destroyDeveRetornarFalso() {
        var id = 1;

        when(service.destroy(id)).thenReturn(false);

        assertThat(
                mockMvcTester.delete().uri("/${pluralKebabName}/{id}", id))
            .hasStatus(HttpStatus.NOT_FOUND)
            .body()
            .isEmpty();
        verify(service).destroy(id);
    }

    @Test
    void destroyDeveLancarExcecao() {
        var id = 1;

        doThrow(new ResponseStatusException(HttpStatus.BAD_REQUEST)).when(service).destroy(id);

        assertThat(
                mockMvcTester.delete().uri("/${pluralKebabName}/{id}", id))
            .hasStatus(HttpStatus.BAD_REQUEST);
        verify(service).destroy(id);
    }

    @Test
    void filterDeveConsultarPorExemplo() {
        String query = "Example";
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var dto = Instancio.createBlank(${moduleName}DTO.class);
        dto.set${fieldStrPascal}(query);
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var list = Instancio.ofList(${moduleName}DTO.class).size(pageSize).set(field(${moduleName}DTO::get${fieldStrPascal}), query).create();
        var page = new PageImpl<>(list, pageable, total);

        when(service.filter(
            argThat(m -> EqualsBuilder.reflectionEquals(m, dto)),
            any()
        )).thenReturn(page);

        assertThat(
                mockMvcTester.get().uri("/${pluralKebabName}/filter")
                .param("${fieldStr}", query))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.content", val ->
                val.assertThat().asArray().extracting("${fieldStr}").containsOnly(query));
        verify(service).filter(any(${moduleName}DTO.class), any());
    }

    @Test
    void filterDevePaginarEntidades() {
        int pageNumber = 2;
        int pageSize = 2;
        int total = 10;
        int totalPages = Math.ceilDiv(total, pageSize);
        int offset = pageNumber * pageSize;
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var list = Instancio.ofList(${moduleName}DTO.class).size(pageSize).create();
        var page = new PageImpl<>(list, pageable, total);

        when(service.filter(
            any(),
            argThat(p -> p.getPageNumber() == pageNumber && p.getPageSize() == pageSize))
        ).thenReturn(page);

        assertThat(
                mockMvcTester.get().uri("/${pluralKebabName}/filter")
                .param("pageNumber", String.valueOf(pageNumber))
                .param("pageSize", String.valueOf(pageSize)))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.totalPages", val -> val.assertThat().isEqualTo(totalPages))
            .hasPathSatisfying("$.totalElements", val -> val.assertThat().isEqualTo(total))
            .hasPathSatisfying("$.size", val -> val.assertThat().isEqualTo(pageSize))
            .hasPathSatisfying("$.pageable.offset", val -> val.assertThat().isEqualTo(offset))
            .hasPathSatisfying("$.pageable.pageNumber", val -> val.assertThat().isEqualTo(pageNumber))
            .hasPathSatisfying("$.content", val -> val.assertThat().asArray().hasSize(pageSize))
            .hasPathSatisfying("$.content[0].id", val -> val.assertThat().isEqualTo(list.getFirst().getId()));
    }

    @Test
    void filterDeveOrdernarEntidades() {
        String directions = "desc,desc";
        String sortProps = "id,${fieldStr}";
        String sortString = "id: DESC,${fieldStr}: DESC";
        int pageNumber = 0;
        int pageSize = 2;
        int total = 10;
        var pageable = PageRequest.of(pageNumber, pageSize, mock(Sort.class));
        var item1 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 2).create();
        var item2 = Instancio.of(${moduleName}DTO.class).set(field(${moduleName}DTO::getId), 1).create();
        var page = new PageImpl<>(List.of(item1, item2), pageable, total);

        when(service.filter(
            any(),
            argThat(p -> p.getSort().toString().equals(sortString)))
        ).thenReturn(page);

        assertThat(
                mockMvcTester.get().uri("/${pluralKebabName}/filter")
                .param("directions", directions)
                .param("sortProps", sortProps))
            .hasStatusOk()
            .hasContentType(MediaType.APPLICATION_JSON)
            .bodyJson()
            .hasPathSatisfying("$.content",
                val -> val.assertThat().asArray().extracting("id").containsExactly(2, 1));
    }

}

`;
}

export async function buildAngularModelFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const properties = columns.map(col => `${columnToFieldJava(col.column)}: ${columnToTypeTypeScript(col, dialect)}`);

  const modelTemplate = `
export interface ${moduleName} {
  ${properties.join('\n  ')}
}
  `;
  return modelTemplate;
}

export async function buildAngularDataTableFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const moduleNameKebab = pascalToKebabCase(moduleName);
  const columns = schema.columns;

  const formFields = columns.map(field => {
    const fieldName = columnToFieldJava(field.column);
      return `
          <!-- ${field.label} -->
          <div class="fx-col-1">
            <mat-form-field appearance="outline">
              <mat-label>${field.label}</mat-label>
              <input matInput type="text" formControlName="${fieldName}" />
              @if(form.controls.${fieldName}.invalid){
              <mat-error>Campo obrigatório.</mat-error>
              }
            </mat-form-field>
          </div>`;
  });

  const tableColumns = columns.map(column => {
    const colName = columnToFieldJava(column.column);
    return `
        <!-- ${column.label} Column -->
        <ng-container matColumnDef="${colName}">
          <th mat-header-cell *matHeaderCellDef mat-sort-header class="th-bold-center">
            ${column.label}
            <app-sort-icon column="${colName}" [sorts]="sorts()" />
          </th>
          <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6">
            {{ el.${colName} }}
            @if (el.${colName} === null) {
            <mat-chip>{{ dataNotFound }}</mat-chip>
            }
          </td>
        </ng-container>`;
  });

  const datatableTemplate = `
import { AfterViewInit, Component, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from 'src/app/shared/material.module';
import { Page } from 'src/app/shared/models/page.model';
import { PageEvent } from '@angular/material/paginator';
import { PageControl } from 'src/app/shared/models/page-control.model';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { SpinnerTextService } from 'src/app/shared/services/spinner-text.service';
import { MatSort, Sort } from '@angular/material/sort';
import { SortIconComponent } from 'src/app/components/sort-icon/sort-icon.component';
import { ${moduleName} } from '../${moduleNameKebab}.model';
import { ${moduleName}Service } from '../${moduleNameKebab}.service';

@Component({
  selector: 'app-${moduleNameKebab}-datatable',
  imports: [ReactiveFormsModule, MaterialModule, SortIconComponent],
  template: \`
<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header bg-primary">
      <h1>Consulta ${humanName}</h1>
    </div>
    <div class="card-body">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">

        <div class="fx-grid">
          ${formFields.join('\n')}

        </div>

        <div class="d-flex">
          <button type="submit" mat-raised-button color="primary" class="me-2" [disabled]="isLoading">
            <i class="fa-solid fa-magnifying-glass"></i> Consultar
          </button>
          <button type="button" mat-raised-button (click)="clearForm()" [disabled]="isLoading">
            <i class="fa-solid fa-eraser"></i> Limpar
          </button>
          <a routerLink="./new" class="ms-auto" [hidden]="true">
            <button type="button" color="primary" mat-raised-button>
              <i class="fa-solid fa-plus"></i>
              Novo
            </button>
          </a>
        </div>

      </form>
    </div>
  </div>
</div>

<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header">
      Resultado
    </div>
    <div class="card-body">
      <div class="datatable-panel">
        <table mat-table [dataSource]="datasource" matSort multiTemplateDataRows
          class="table table-striped table-hover table-bordered table-condensed table-border-brown">
          ${tableColumns.join('\n')}

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="th-bold-center">
              Ações
            </th>
            <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6 w2-actions">
              <button type="button" mat-icon-button color="primary" matTooltip="Visualizar">
                <mat-icon>visibility</mat-icon>
              </button>
            </td>
          </ng-container>

          <!-- Footer Column -->
          <ng-container matColumnDef="footer">
            <td mat-footer-cell *matFooterCellDef [attr.colspan]="displayedColumns.length" class="bg-color-lightbrown">
              <div class="container p-3">
                <div class="row g-3 text-center">
                  <div class="col-12 fs-6">
                    @if(isLoading) {
                    <i class="fa-solid fa-spinner fa-spin-pulse"></i> Carregando ...
                    } @else {
                    {{ isFirstSearch ? 'Faça uma consulta.' : 'Nenhum registro encontrado.' }}
                    }
                  </div>
                </div>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
          <tr mat-footer-row *matFooterRowDef="displayFooter" [hidden]="displayFooter.length === 0"></tr>
        </table>
      </div>

      <mat-paginator [length]="entityPage.totalElements" [pageSize]="entityPage.size" [pageIndex]="entityPage.number"
        [showFirstLastButtons]="true" [pageSizeOptions]="[5, 10, 20, 50, 100]" (page)="onPageChange($event)"
        aria-label="Selecione a página" class="pagination-bottom-border">
      </mat-paginator>

    </div>
  </div>
</div>
  \`,
  styles: [\`
/* Fix Mat Table */

.table-border-brown {
  border-color: #dee2e6;
  margin: 0 !important;
}

.th-bold-center {
  font-size: 16px;
  font-weight: bold;
  vertical-align: middle;
  text-align: center;
}

.bg-color-lightbrown {
  background-color: #f2f2f2;
}

::ng-deep .mat-sort-header-container {
  display: flex;
  justify-content: center;
}

::ng-deep .mat-sort-header .mat-sort-header-arrow {
  display: none !important;
}

.datatable-panel {
  overflow-x: auto;
  scrollbar-width: 6px;
}

.datatable-panel::-webkit-scrollbar-thumb {
  background-color: #388e3c;
  border-radius: 6px;
}

.datatable-panel::-webkit-scrollbar {
  height: 6px;
}
  \`]
})
export class ${moduleName}DataTableComponent implements AfterViewInit {

  private fb = inject(FormBuilder);
  private alert = inject(AlertService);
  private spinnerText = inject(SpinnerTextService);
  private service = inject(${moduleName}Service);

  form = this.fb.group({
    ${columns.map(c => columnToFieldJava(c.column) + ': [\'\'],').join('\n    ')}
  });

  isFirstSearch = true;
  enableSearch = false;
  isLoading = false;

  datasource = new MatTableDataSource(<${moduleName}[]>[]);
  displayedColumns: string[] = [${columns.map(c => '\'' + columnToFieldJava(c.column) + '\'').join(', ')}, 'actions'];
  displayFooter = ['footer'];

  readonly dataNotFound = 'Não foi informado!';

  entity = <${moduleName}>{};
  entityPage = <Page<${moduleName}>>{ size: 10 };
  pageCtl: PageControl = <PageControl>{
    pageNumber: 0,
    pageSize: 10,
    directions: '',
    sortProps: '',
  };

  @ViewChild(MatSort) sortViewChild: MatSort = <MatSort>{};
  sorts = signal<{ active: string, direction: string }[]>([]);

  ngAfterViewInit(): void {
    this.sortViewChild.sortChange.subscribe({
      next: (sort: Sort) => {
        const item = this.sorts().find(o => o.active === sort.active);
        if (item) {
          if (sort.direction !== '') item.direction = sort.direction;
          else this.sorts.set(this.sorts().filter(o => o.active != item.active));
        } else {
          if (sort.direction !== '') {
            const sortsArr = this.sorts();
            sortsArr.push(sort);
            this.sorts.set(sortsArr);
          }
        }
        const sortProps = this.sorts().map(o => o.active).join(',');
        const directions = this.sorts().map(o => o.direction).join(',');
        if (sortProps !== this.pageCtl.sortProps || directions !== this.pageCtl.directions) {
          this.pageCtl.sortProps = sortProps;
          this.pageCtl.directions = directions;
          this.search();
        }
      }
    });
  }

  onSubmit() {
    this.trimFields();
    if (this.form.valid) {
      this.pageCtl.pageNumber = 0;
      this.entity = <${moduleName}>{
        ...this.form.value as any,
      };
      this.isFirstSearch = false;
      this.enableSearch = true;
      this.search();
    }
  }

  trimFields() {
    Object.keys(this.form.value)
      .map(f => this.form.get(f))
      .filter(f => typeof f?.value === 'string')
      .map(f => f?.setValue(f?.value.trim()));
  }

  async search() {
    if (!this.enableSearch) return;
    this.enableSearch = false;
    this.isLoading = true;
    this.spinnerText.show('Carregando dados da tabela ...');
    try {
      const page = await firstValueFrom(this.service.filter(this.entity, this.pageCtl));
      this.displayFooter = page.content?.length !== 0 ? [] : ['footer'];
      this.entityPage = page;
      this.datasource = new MatTableDataSource(this.entityPage.content);
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse) {
        if (e.status === HttpStatusCode.NotFound) {
          this.alertWarn(e.error.message);
        } else if (e.status === HttpStatusCode.BadRequest) {
          this.alertWarn(e.error.message);
        } else console.log(e);
      } else console.log(e);
    }
    this.spinnerText.hide();
    this.isLoading = false;
    this.enableSearch = true;
  }

  onPageChange(event: PageEvent) {
    this.pageCtl.pageNumber = event.pageIndex;
    this.pageCtl.pageSize = event.pageSize;
    this.search();
  }

  clearForm() {
    this.form.reset({
      ${columns.map(c => columnToFieldJava(c.column) + ': \'\',').join('\n      ')}
    });
    this.enableSearch = false;
    this.isFirstSearch = true;
  }

  alertWarn(e: any) {
    this.alert.show({
      title: 'Alerta',
      message: e,
      iconClass: 'fa-solid fa-circle-exclamation',
      type: 'warning',
      timeout: 15000,
    });
  }

}
  `;
  return datatableTemplate;
}
