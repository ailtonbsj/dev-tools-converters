import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToTypeJava } from "../sql-datastructs/datastructs";

export async function buildRepositoryJPAFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);
  const pkType = columnToTypeJava(primaries[0], dialect);
  const typeDeclaration = primaries.length > 1 ? `${moduleName}PK` : pkType;


  return `
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ${moduleName}Repository extends JpaRepository<${moduleName}, ${typeDeclaration}> {

    String SQL = """
      select * from ${schema.schema}.${schema.table} e
      where
        (coalesce(:keyword, '') = '' or (
          e.id like upper('%' || :keyword || '%')
        ))
    """;

    @Query(value = SQL, nativeQuery = true)
    Page<${moduleName}> findByKeyword(String keyword, Pageable pageable);

}
`;

}
