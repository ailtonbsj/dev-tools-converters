import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToTypeJava, Dialect } from "../module-buillders";

export async function buildEntityJPAPrimaryKey(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const fieldsDeclarations = primaries.map(p => `private ${columnToTypeJava(p, dialect)} ${columnToFieldJava(p.column)};`);

  return `
import lombok.*;

import java.io.Serializable;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class ${moduleName}PK implements Serializable {

    ${fieldsDeclarations.join('\n    ')}

}
`;
}
