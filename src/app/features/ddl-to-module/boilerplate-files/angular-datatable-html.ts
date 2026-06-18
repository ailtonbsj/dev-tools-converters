import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { inputDate, inputDateTime, inputText, maskedAsCurrency, staticSelect } from "../ui-table-colunms";
import { columnToTypeJava } from "../sql-datastructs/datastructs";
import { pascalToCamelCase } from "../case-util";

export async function buildAngularDataTableHTMLFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const moduleNameCamel = pascalToCamelCase(moduleName);
  const columns = schema.columns;

  const formFields = columns.map(field => {
    const fieldName = field.javaFieldName;
    const length = field.len ?? 100;
      return `
          <!-- ${field.label} -->
          <div class="fx-col-1">
            <mat-form-field appearance="outline">
              <mat-label>${field.label}</mat-label>
              <input matInput type="text" formControlName="${fieldName}" maxlength="${length}" />
              @if (form.controls.${fieldName}.invalid) {
              <mat-error>Campo obrigatório.</mat-error>
              }
            </mat-form-field>
          </div>`;
  });

  const tableColumns = columns.map(column => {
    const colName = column.javaFieldName;
    const ui = column.uiComponent;
    const javaType = columnToTypeJava(column, dialect);

    if(ui != null) {
      if(ui === 'maskedAsNumber')
        return inputText(column.label, colName);
      else if(ui === 'autoComplete')
        return inputText(column.label, colName);
      else if(ui === 'inputDate')
        return inputDate(column.label, colName);
      else if(ui === 'inputDateTime')
        return inputDateTime(column.label, colName);
      else if(ui === 'maskedAsCurrency')
        return maskedAsCurrency(column.label, colName);
      else if(ui === 'staticSelect')
        return staticSelect(column.label, colName);
    } else {
      if(['Integer', 'Long'].includes(javaType))
        return inputText(column.label, colName);
      else if(['LocalDate'].includes(javaType))
        return inputDate(column.label, colName);
      else if(['LocalDateTime'].includes(javaType))
        return inputDateTime(column.label, colName);
    }
    return inputText(column.label, colName);
  });

  return `
<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header bg-primary">
      <h1>Consulta ${humanName}</h1>
    </div>
    <div class="card-body">
      <form [formGroup]="form${moduleName}" (ngSubmit)="onSubmit${moduleName}()">

        <div class="fx-grid">
          ${formFields.join('\n')}

        </div>

        <div class="d-flex">
          <button type="submit" mat-raised-button color="primary" class="me-2" [disabled]="is${moduleName}Loading">
            <i class="fa-solid fa-magnifying-glass"></i> Consultar
          </button>
          <button type="button" mat-raised-button (click)="clearForm${moduleName}()" [disabled]="is${moduleName}Loading">
            <i class="fa-solid fa-eraser"></i> Limpar
          </button>
          <button type="button" color="primary" mat-raised-button (click)="showNew${moduleName}Form()">
            <i class="fa-solid fa-plus"></i>
            Novo
          </button>
        </div>

      </form>
    </div>
  </div>
</div>

<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header d-flex align-items-center justify-content-between">
      <span>Resultado</span>
      <div>
        <button type="button" mat-flat-button [matMenuTriggerFor]="menu${moduleName}">
          <i class="fa-solid fa-tasks"></i> Colunas
        </button>
      </div>
      <mat-menu #menu${moduleName}="matMenu">
        <mat-selection-list #columnList>
          @for (column of columns; track column.id) {
            <mat-list-option [selected]="column.enabled" [value]="column.id"
              (click)="onColumnMenuClick(columnList); $event.stopPropagation()">
              {{ column.label }}
            </mat-list-option>
          }
        </mat-selection-list>
      </mat-menu>
    </div>
    <div class="card-body">
      <div class="datatable-panel">
        <table mat-table [dataSource]="datasource${moduleName}" matSort multiTemplateDataRows
          class="table table-striped table-hover table-bordered table-condensed table-border-brown">
          ${tableColumns.join('\n')}

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="th-bold-center">
              Ações
            </th>
            <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6 w2-actions">
              <button type="button" mat-icon-button color="primary" matTooltip="Visualizar" (click)="showReadOnly${moduleName}Form(el.id)" [hidden]="true">
                <mat-icon>visibility</mat-icon>
              </button>
              <button type="button" mat-icon-button color="primary" matTooltip="Editar" (click)="showEdit${moduleName}Form(el.id)" [hidden]="false">
                <mat-icon>edit</mat-icon>
              </button>
              <button type="button" mat-icon-button color="warn" matTooltip="Remover" (click)="confirmRemove${moduleName}(el.id)" [hidden]="false">
                <mat-icon>delete</mat-icon>
              </button>
            </td>
          </ng-container>

          <!-- Footer Column -->
          <ng-container matColumnDef="footer">
            <td mat-footer-cell *matFooterCellDef [attr.colspan]="displayed${moduleName}Columns.length" class="bg-color-lightbrown">
              <div class="container p-3">
                <div class="row g-3 text-center">
                  <div class="col-12 fs-6">
                    @if(is${moduleName}Loading) {
                    <i class="fa-solid fa-spinner fa-spin-pulse"></i> Carregando ...
                    } @else {
                    {{ isFirst${moduleName}Search ? 'Faça uma consulta.' : 'Nenhum registro encontrado.' }}
                    }
                  </div>
                </div>
              </div>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayed${moduleName}Columns"></tr>
          <tr mat-footer-row *matFooterRowDef="display${moduleName}Footer" [hidden]="display${moduleName}Footer.length === 0"></tr>
        </table>
      </div>

      <mat-paginator [length]="${moduleNameCamel}Page.totalElements" [pageSize]="${moduleNameCamel}Page.size" [pageIndex]="${moduleNameCamel}Page.number"
        [showFirstLastButtons]="true" [pageSizeOptions]="[5, 10, 20, 50, 100]" (page)="on${moduleName}PageChange($event)"
        aria-label="Selecione a página" class="pagination-bottom-border">
      </mat-paginator>

    </div>
  </div>
</div>
`;

}
