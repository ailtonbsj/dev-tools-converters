export function inputText(label: string, fieldName: string, lenChars: number) {
      return `
          <!-- ${label} -->
          <div class="fx-col-2">
            <mat-form-field appearance="outline">
              <mat-label>${label}</mat-label>
              <input matInput type="text" formControlName="${fieldName}" maxlength="${lenChars}" />
              @if (form.controls.${fieldName}.invalid) {
              <mat-error>Campo obrigatório.</mat-error>
              }
            </mat-form-field>
          </div>
`;
}

export function maskedAsNumber(label: string, fieldName: string, lenChars: number) {
      return `
          <!-- ${label} -->
          <div class="fx-col-2">
            <mat-form-field appearance="outline">
              <mat-label>${label}</mat-label>
              <input matInput type="text" formControlName="${fieldName}" maxlength="${lenChars}" mask="0*" />
              @if (form.controls.${fieldName}.invalid) {
              <mat-error>Campo obrigatório.</mat-error>
              }
            </mat-form-field>
          </div>
`;
}

export function staticSelect(label: string, fieldName: string, allowValues: string[]) {

  if(allowValues == null) allowValues = ['S', 'N'];
  const options = allowValues.map(val => {
    let label = val;
    if(val === 'S') label = 'Sim';
    else if(val === 'N') label = 'Não';
    `<mat-option value="${val}">${label}</mat-option>`;
  });

  return `
          <!-- ${label} -->
          <div class="fx-col-2">
              <mat-form-field appearance="outline">
                  <mat-label>${label}</mat-label>
                  <mat-select formControlName="${fieldName}">
                    <mat-option value="">Selecione ...</mat-option>
                    <mat-option value="S">Sim</mat-option>
                    <mat-option value="N">Não</mat-option>
                  </mat-select>
                  @if (form.controls.${fieldName}.invalid) {
                  <mat-error>Campo obrigatório.</mat-error>
                  }
              </mat-form-field>
          </div>
`;
}

export function autoComplete(label: string, fieldName: string, fieldNamePascal: string) {
  return `
          <!-- ${label} -->
          <div class="fx-col-2">
              <mat-form-field appearance="outline">
                  <mat-label>${label}</mat-label>
                  <input matInput type="text" formControlName="${fieldName}" [matAutocomplete]="auto${fieldNamePascal}"
                    (keyup)="onKeyUpAuto${fieldNamePascal}($event)" placeholder="Digite um termo para buscar" />
                  @if (!isViewRead) {
                  <button type="button" matSuffix mat-icon-button (click)="clearAuto${fieldNamePascal}()">
                      <mat-icon>close</mat-icon>
                  </button>
                  }
                  <mat-autocomplete autoActiveFirstOption #auto${fieldNamePascal}="matAutocomplete"
                      [displayWith]="displayWith${fieldNamePascal}()">
                      @if(is${fieldNamePascal}Loading) {
                      <mat-option class="list-item-loading" disabled="true">
                        <i class="fa-solid fa-spinner fa-spin-pulse"></i> Carregando ...
                      </mat-option>
                      } @else if(has${fieldNamePascal}Fetched) {
                        @for (item of ${fieldName}List; track item.id) {
                        <mat-option [value]="item">{{ item.id }} - {{ item.target }}</mat-option>
                        }
                        @empty {
                        <mat-option disabled>Nenhum registro encontrado.</mat-option>
                        }
                      }
                  </mat-autocomplete>
                  @if (form.controls.${fieldName}.invalid) {
                      <mat-error>Campo obrigatório.</mat-error>
                  }
              </mat-form-field>
          </div>
`;
}
