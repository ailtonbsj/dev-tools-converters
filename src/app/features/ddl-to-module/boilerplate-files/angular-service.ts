import { plural } from "@umatch/pluralize-ptbr";
import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToTypeTypeScript, Dialect, pascalToKebabCase } from "../module-buillders";

export async function buildAngularServiceFromDdl(moduleName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const pluralKebabName = plural(pascalToKebabCase(moduleName));
  const columns = schema.columns;
  const properties = columns.map(col => `${columnToFieldJava(col.column)}: ${columnToTypeTypeScript(col, dialect)}`);

  return `
import { HttpClient, HttpParams } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { environment } from "src/environments/environment";
import { PageControl } from "src/app/shared/models/page-control.model";
import { first, Observable } from "rxjs";
import { Page } from "src/app/shared/models/page.model";
import { ${moduleName} } from "./${pascalToKebabCase(moduleName)}.model";

@Injectable({
  providedIn: 'root',
})
export class ${moduleName}Service {

  private http = inject(HttpClient);

  baseUrl = environment.api.baseUrl;
  endpoint = \`\${this.baseUrl}/${pluralKebabName}\`;

  filter(entity: ${moduleName}, pageCtl: PageControl): Observable<Page<${moduleName}>> {
    const httpParams = Object.fromEntries(Object.entries(entity));
    const params = new HttpParams({ fromObject: { ...httpParams, ...pageCtl } });
    return this.http.get<Page<${moduleName}>>(\`\${this.endpoint}/filter\`, { params }).pipe(first());
  }

  search(keyword: string): Observable<${moduleName}[]> {
    const params = new HttpParams({ fromObject: { keyword} });
    return this.http.get<${moduleName}[]>(\`\${this.endpoint}/search\`, { params }).pipe(first());
  }

  show(id: number): Observable<${moduleName}> {
    return this.http.get<${moduleName}>(\`\${this.endpoint}/\${id}\`).pipe(first());
  }

  create(entity: ${moduleName}): Observable<${moduleName}> {
    return this.http.post<${moduleName}>(\`\${this.endpoint}\`, entity);
  }

  update(entity: ${moduleName}): Observable<${moduleName}> {
    return this.http.put<${moduleName}>(\`\${this.endpoint}/\${entity.id}\`, entity);
  }

  destroy(id: number): Observable<void> {
    return this.http.delete<void>(\`\${this.endpoint}/\${id}\`);
  }

}
`;

}
