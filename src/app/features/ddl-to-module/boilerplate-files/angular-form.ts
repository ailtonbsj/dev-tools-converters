import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, columnToPascalFieldJava, columnToTypeJava, columnToTypeTypeScript, Dialect, pascalToKebabCase } from "../module-buillders";
import { autoComplete, inputText, maskedAsNumber, staticSelect } from "../ui-form-components";

export async function buildAngularFormFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const moduleNameKebab = pascalToKebabCase(moduleName);
  const columns = schema.columns;

  const formFields = columns.map(field => {
    const javaType = columnToTypeJava(field, dialect);
    const fieldName = columnToFieldJava(field.column);
    const fieldNamePascal = columnToPascalFieldJava(field.column);
    const ui = field.uiComponent;

    if(ui != null) {
      if(ui === 'maskedAsNumber')
        return maskedAsNumber(field.label, fieldName, field.lenChars);
      else if(ui === 'staticSelect')
        return staticSelect(field.label, fieldName, field.allowValues);
      else if(ui === 'autoComplete')
        return autoComplete(field.label, fieldName, fieldNamePascal);
    } else {
      if(['Integer', 'Long'].includes(javaType))
        return maskedAsNumber(field.label, fieldName, field.lenChars);
    }
    return inputText(field.label, fieldName, field.lenChars);
  });

  const declareFormFields = columns.map(field => {
    const fieldName = columnToFieldJava(field.column);
    const fieldNamePascal = columnToPascalFieldJava(field.column);
    const fieldType = columnToTypeTypeScript(field, dialect);
    if (field.uiComponent === 'autoComplete') {
      return `${fieldName}: this.fb.control({} as ${fieldNamePascal}${field.isNullable ? '' : ', [Validators.required, AutocompleteValidator.required()]'}),`;
    } else
      return `${fieldName}: this.fb.control<${fieldType}>(''${ fieldType != 'string' ? ' as any' : '' }${field.isNullable ? '' : ', Validators.required'}),`;
  });

  const snippetsAutoComplete = columns.filter(col => col.uiComponent === 'autoComplete').map(field => {
    const fieldName = columnToFieldJava(field.column);
    const fieldNamePascal = columnToPascalFieldJava(field.column);

    return `
  /* ${fieldNamePascal} Autocomplete routines BEGIN */

  ${fieldName}Subject$: Subject<string> = new Subject();
  ${fieldName}List: ${fieldNamePascal}[] = [];
  is${fieldNamePascal}Loading = false;
  has${fieldNamePascal}Fetched = true;

  ${fieldName}Request(val: string): Observable<Page<${fieldNamePascal}>> {
    const pageCtl = <PageControl>{
      pageNumber: 0,
      pageSize: 10,
      directions: '',
      sortProps: '',
    };
    return this.${fieldName}Service.filter(val, pageCtl);
  }

  onKeyUpAuto${fieldNamePascal}(e: KeyboardEvent) {
    const term = (<HTMLInputElement>e.target).value;
    if(term.length < 3) return;
    this.${fieldName}Subject$.next(term);
    this.is${fieldNamePascal}Loading = true;
  }

  clearAuto${fieldNamePascal}() {
    this.form.controls.${fieldName}.setValue(<${fieldNamePascal}>{});
  }

  displayWith${fieldNamePascal}(): ((value: any) => string) | null {
    return (entity: ${fieldNamePascal}) =>
      entity.id === undefined
        ? ''
        : \`\${entity.target} - \${entity.id}\`;
  }

  selected${fieldNamePascal}(event: MatAutocompleteSelectedEvent) {
    console.log(event.option.value);
  }

  init${fieldNamePascal}Autocomplete() {
    this.${fieldName}Subject$.asObservable().pipe(debounceTime(1000), switchMap((v) => this.${fieldName}Request(v)))
      .subscribe({
        next: (v) => {
          this.${fieldName}List = [...v.content];
          this.is${fieldNamePascal}Loading = false;
          this.has${fieldNamePascal}Fetched = false;
        },
        error: e => { this.is${fieldNamePascal}Loading = false; }
      });
  }

  /* ${fieldNamePascal} Autocomplete routines END */

`;
  });

  return `
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/shared/material.module';
import { ${moduleName}Service } from '../${moduleNameKebab}.service';
import { firstValueFrom } from 'rxjs';
import { ${moduleName} } from '../${moduleNameKebab}.model';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';

@Component({
  selector: 'app-${moduleNameKebab}-form',
  imports: [FormsModule, ReactiveFormsModule, MaterialModule],
  template: \`
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
  \`,
  styleUrl: './${moduleNameKebab}-form.component.scss',
})
export class ${moduleName}FormComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private alert = inject(AlertService);
  private service = inject(${moduleName}Service);

  // Initialize view state flags
  readonly isViewNew = this.route.snapshot.url.at(-1)?.path === 'novo';
  readonly isViewEdit = this.route.snapshot.url.at(-1)?.path === 'edicao';
  readonly isViewRead = !this.isViewNew && !this.isViewEdit;

  readonly entityId = this.route.snapshot.params.id;
  readonly modeLabel = this.isViewNew ? 'Novo' : this.isViewEdit ? 'Edição' : 'Somente Visualização';

  fallback = '/app/${moduleNameKebab}/';

  form = this.fb.group({
    ${declareFormFields.join('\n    ')}
  });

  async ngOnInit() {
    // Redirect if wrong entityId
    if ((this.isViewEdit || this.isViewRead) && (this.entityId == null || this.entityId === '')) this.router.navigate([this.fallback]);
    if (this.isViewNew) this.form.enable();
    if (this.isViewEdit || this.isViewRead) this.loadForm();
    if (this.isViewRead) this.form.disable();
  }

  navigateBack() {
    this.router.navigate([this.fallback]);
  }

  async loadForm() {
    const entity = await firstValueFrom(this.service.show(this.entityId));
    const nullEntity = Object.fromEntries(
      Object.entries(entity).filter(kv => kv[1] === null).map(kv => [kv[0], ''])
    );
    this.form.patchValue({ ...entity, ...nullEntity });
  }

  async onSubmit() {
    this.trimFields();
    if (this.form.valid) {
      const entity = { ...this.form.value } as ${moduleName};
      try {
        if (this.isViewNew) {
          const res = await firstValueFrom(this.service.create(entity));
          this.alertSuccess(\`${humanName} com ID \${res.id} criada com sucesso!\`);
        } else if (this.isViewEdit) {
          const res = await firstValueFrom(this.service.update(entity));
          this.alertSuccess(\`${humanName} com ID \${res.id} atualizada com sucesso!\`);
        }
        this.navigateBack();
      } catch (e: unknown) {
        if (e instanceof HttpErrorResponse) {
          if (e.status === HttpStatusCode.BadRequest) {
            const msg = e.error.errors ? e.error.errors[0].defaultMessage : e.error.message;
            this.alertWarn(msg);
          } else console.log(e);
        } else console.log(e);
      }
    }
  }

  trimFields() {
    Object
      .keys(this.form.value)
      .map(f => this.form.get(f))
      .filter(f => typeof f?.value === 'string')
      .map(f => f?.setValue(f?.value.trim()));
  }

  alertSuccess(message: string) {
    this.alert.show({
      title: 'Salvo',
      message,
      iconClass: 'fa-solid fa-floppy-disk',
      type: 'success',
      timeout: 15000,
    });
  }

  alertWarn(e: any) {
    this.alert.show({
      title: 'Alerta',
      message: e,
      iconClass: 'fa-solid fa-circle-exclamation',
      type: 'warning',
      timeout: 15000,
    });
  }

${snippetsAutoComplete.join('')}

}

`;

}
