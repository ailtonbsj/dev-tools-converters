import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToTypeTypeScript } from "../sql-datastructs/datastructs";

export async function buildAngularModelFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const properties = columns.map(col => `${col.javaFieldName}: ${columnToTypeTypeScript(col, dialect)}`);
  const primaries = columns.filter(col => col.isPrimary);

  const idCompoudDeclaration = primaries.length > 1 ? `\n  id?: string;` : '';

  return `
export interface ${moduleName} {${idCompoudDeclaration}
  ${properties.join('\n  ')}
}
`;

}
