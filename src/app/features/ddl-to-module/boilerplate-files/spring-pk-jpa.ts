import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToTypeJava } from "../sql-datastructs/datastructs";

export async function buildEntityJPAPrimaryKey(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const fieldsDeclarations = primaries.map(p => `private ${columnToTypeJava(p, dialect)} ${p.javaFieldName};`);

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
