import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToTypeJava, Dialect } from "../module-buillders";

export async function buildServiceFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const pkType = columnToTypeJava(primaries[0], dialect);
  const typeDeclaration = primaries.length > 1 ? `${moduleName}PK` : pkType;

  const pkId = columnToFieldJava(primaries[0].column);

  return `
import org.springframework.data.domain.*;
import java.util.*;

public interface ${moduleName}Service {

    Optional<${moduleName}DTO> show(${typeDeclaration} ${pkId});

    List<${moduleName}DTO> index();

    ${moduleName}DTO create(${moduleName}DTO model);

    ${moduleName}DTO update(${typeDeclaration} ${pkId}, ${moduleName}DTO model);

    boolean destroy(${typeDeclaration} ${pkId});

    Page<${moduleName}DTO> search(String keyword, Pageable pageable);

    Page<${moduleName}DTO> filter(${moduleName}DTO example, Pageable pageable);

}
`;

}
