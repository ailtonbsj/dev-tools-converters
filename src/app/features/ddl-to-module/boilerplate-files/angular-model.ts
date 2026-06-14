import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToTypeTypeScript, Dialect } from "../module-buillders";

export async function buildAngularModelFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const columns = schema.columns;
  const properties = columns.map(col => `${columnToFieldJava(col.column)}: ${columnToTypeTypeScript(col, dialect)}`);
  const primaries = columns.filter(col => col.isPrimary);

  const idCompoudDeclaration = primaries.length > 1 ? `\n  id?: string;` : '';

  return `
export interface ${moduleName} {${idCompoudDeclaration}
  ${properties.join('\n  ')}
}
`;

}
