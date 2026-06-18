import { pascalToKebabCase, pascalToSnakeCase } from "../case-util";

export async function buildAngularRoutesFromDdl(moduleName: string) {
  const moduleNameKebab = pascalToKebabCase(moduleName);
  const moduleNameSnakeUp = pascalToSnakeCase(moduleName).toUpperCase();

  return `
import { Routes } from "@angular/router";
import { ${moduleName}DatatableComponent } from "./${moduleNameKebab}/${moduleNameKebab}-datatable/${moduleNameKebab}-datatable.component";
import { ${moduleName}FormComponent } from "./${moduleNameKebab}/${moduleNameKebab}-form/${moduleNameKebab}-form.component";

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: '${moduleNameKebab}'
  },
  {
    path: '${moduleNameKebab}',
    canMatch: [AuthGuard, roleGuard],
    data: { role: '${moduleNameSnakeUp}_VER' },
    component: ${moduleName}ConsultaComponent
  },
  {
    path: '${moduleNameKebab}/novo',
    canMatch: [AuthGuard, roleGuard],
    data: { role: '${moduleNameSnakeUp}_INSERIR' },
    component: ${moduleName}FormComponent
  },
  {
    path: '${moduleNameKebab}/:id',
    canMatch: [AuthGuard, roleGuard],
    data: { role: '${moduleNameSnakeUp}_VER' },
    component: ${moduleName}FormComponent
  },
  {
    path: '${moduleNameKebab}/:id/edicao',
    canMatch: [AuthGuard, roleGuard],
    data: { role: '${moduleNameSnakeUp}_EDITAR' },
    component: ${moduleName}FormComponent
  },
];
`;
}
