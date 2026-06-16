import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToPascalFieldJava } from "../module-buillders";
import { autoComplete, inputDate, inputDateTime, inputText, maskedAsCurrency, maskedAsFloat, maskedAsNumber, staticSelect } from "../ui-form-components";
import { columnToTypeJava } from "../sql-datastructs/datastructs";

export async function buildAngularFormHTMLFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect) {
  const columns = schema.columns;

  const formFields = columns.map(field => {
    const javaType = columnToTypeJava(field, dialect);
    const fieldName = field.javaFieldName;
    const fieldNamePascal = columnToPascalFieldJava(field.column);
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

  return `
<div class="container-fluid py-3">
  <div class="card">
    <div class="card-header bg-primary">
      <h1>${humanName} - {{ modeLabel }}</h1>
    </div>
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-center pb-3">
        <div class="alert alert-warning m-0 px-3 py-1" role="alert">
          <i class="fa-solid fa-triangle-exclamation"></i>&nbsp;Os campos com * são de preenchimento obrigatórios.
        </div>
        <button class="ms-2" type="button" mat-raised-button (click)="navigateBack()">
          <i class="fa-solid fa-reply-all"></i>
          Voltar
        </button>
      </div>
      <form [formGroup]="form" (submit)="onSubmit()">
        <div class="card">
          <div class="card-header">Formulário</div>
          <div class="card-body">
            <div class="fx-grid">

              ${formFields.join('\n')}

            </div>

            <div class="d-flex">
              <button type="submit" mat-raised-button color="primary" class="ms-auto">
                <i class="fa-solid fa-floppy-disk"></i> {{ isViewNew ? "Salvar" : "Atualizar" }}
              </button>
            </div>

          </div>
        </div>
      </form>
    </div>
  </div>
</div>
`;
}
