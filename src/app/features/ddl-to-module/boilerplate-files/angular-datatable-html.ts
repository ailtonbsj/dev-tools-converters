import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToTypeJava } from "../sql-datastructs/datastructs";
import { camelToPascalCase, pascalToCamelCase, pascalToSnakeCase } from "../case-util";
import { autoComplete, inputDate, inputDateTime, inputText, maskedAsCurrency, maskedAsFloat, maskedAsNumber, staticSelect } from "../ui-form-components";
import { inputDateColumn, inputDateTimeColumn, inputTextColumn, maskedAsCurrencyColumn, staticSelectColumn } from "../ui-table-colunms";

export async function buildAngularDataTableHTMLFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const moduleNameCamel = pascalToCamelCase(moduleName);
  const moduleNameSnakeUp = pascalToSnakeCase(moduleName).toUpperCase();
  const columns = schema.columns;

  const formFields = columns.map(field => {
    const javaType = columnToTypeJava(field, dialect);
    const fieldName = field.javaFieldName;
    const fieldNamePascal = camelToPascalCase(field.javaFieldName);
    const ui = field.uiComponent;
    if(ui != null) {
      if(ui === 'maskedAsNumber')
        return maskedAsNumber(field.label, fieldName, field.lenChars);
      else if(ui === 'staticSelect')
        return staticSelect(field.label, fieldName, field.allowValues);
      else if(ui === 'autoComplete')
        return autoComplete(field.label, fieldName, fieldNamePascal);
      else if(ui === 'inputDate')
        return inputDate(field.label, fieldName, field.lenChars);
      else if(ui === 'inputDateTime')
        return inputDateTime(field.label, fieldName, field.lenChars);
      else if(ui === 'maskedAsCurrency')
        return maskedAsCurrency(field.label, fieldName, field.lenChars);
    } else {
      if(['Integer', 'Long'].includes(javaType))
        return maskedAsNumber(field.label, fieldName, field.lenChars);
      if(['BigDecimal', 'Double', 'Float'].includes(javaType))
        return maskedAsFloat(field.label, fieldName, field.len, field.scale);
      else if(['LocalDate'].includes(javaType))
        return inputDate(field.label, fieldName, field.lenChars);
      else if(['LocalDateTime'].includes(javaType))
        return inputDateTime(field.label, fieldName, field.lenChars);
    }
    return inputText(field.label, fieldName, field.lenChars);
  });

  const tableColumns = columns.map(column => {
    const colName = column.javaFieldName;
    const ui = column.uiComponent;
    const javaType = columnToTypeJava(column, dialect);

    if(ui != null) {
      if(ui === 'maskedAsNumber')
        return inputTextColumn(column.label, colName);
      else if(ui === 'autoComplete')
        return inputTextColumn(column.label, colName);
      else if(ui === 'inputDate')
        return inputDateColumn(column.label, colName);
      else if(ui === 'inputDateTime')
        return inputDateTimeColumn(column.label, colName);
      else if(ui === 'maskedAsCurrency')
        return maskedAsCurrencyColumn(column.label, colName);
      else if(ui === 'staticSelect')
        return staticSelectColumn(column.label, colName);
    } else {
      if(['Integer', 'Long'].includes(javaType))
        return inputTextColumn(column.label, colName);
      else if(['LocalDate'].includes(javaType))
        return inputDateColumn(column.label, colName);
      else if(['LocalDateTime'].includes(javaType))
        return inputDateTimeColumn(column.label, colName);
    }
    return inputTextColumn(column.label, colName);
  });

  return `
<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header bg-primary">
      <h1>Consulta ${humanName}</h1>
    </div>
    <div class="card-body">
      <form [formGroup]="${moduleNameCamel}form" (ngSubmit)="onSubmit${moduleName}()">

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
          <!-- @if (hasRole('${moduleNameSnakeUp}_INSERIR')) { -->
          <button type="button" color="primary" mat-raised-button (click)="showNew${moduleName}Form()">
            <i class="fa-solid fa-plus"></i>
            Novo
          </button>
          <!-- } -->
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
        <button type="button" mat-flat-button [matMenuTriggerFor]="${moduleNameCamel}Menu">
          <i class="fa-solid fa-tasks"></i> Colunas
        </button>
      </div>
      <mat-menu #${moduleNameCamel}Menu="matMenu">
        <mat-selection-list #${moduleNameCamel}ColumnList>
          @for (column of ${moduleNameCamel}Columns; track column.id) {
            <mat-list-option [selected]="column.enabled" [value]="column.id"
              (click)="onColumn${moduleName}MenuClick(${moduleNameCamel}ColumnList); $event.stopPropagation()">
              {{ column.label }}
            </mat-list-option>
          }
        </mat-selection-list>
      </mat-menu>
    </div>
    <div class="card-body">
      <div class="datatable-panel">
        <table mat-table [dataSource]="${moduleNameCamel}Datasource" matSort #sort${moduleName}="matSort" multiTemplateDataRows
          class="table table-striped table-hover table-bordered table-condensed table-border-brown">
          ${tableColumns.join('\n')}

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef class="th-bold-center">
              Ações
            </th>
            <td mat-cell *matCellDef="let el" class="text-center align-middle fs-6 w2-actions">
              <!-- @if (hasRole('${moduleNameSnakeUp}_EDITAR')){ -->
              <button type="button" mat-icon-button color="primary" matTooltip="Editar" (click)="showEdit${moduleName}Form(el.id)" [hidden]="false">
                <mat-icon>edit</mat-icon>
              </button>
              <!-- } @else { -->
              <button type="button" mat-icon-button color="primary" matTooltip="Visualizar" (click)="showReadOnly${moduleName}Form(el.id)" [hidden]="true">
                <mat-icon>visibility</mat-icon>
              </button>
              <!-- } -->
              <!-- @if (hasRole('${moduleNameSnakeUp}_REMOVER')) { -->
              <button type="button" mat-icon-button color="warn" matTooltip="Remover" (click)="confirmRemove${moduleName}(el.id)" [hidden]="false">
                <mat-icon>delete</mat-icon>
              </button>
              <!-- } -->
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
