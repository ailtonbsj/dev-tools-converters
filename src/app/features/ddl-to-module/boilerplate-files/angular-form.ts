import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";
import { columnToPascalFieldJava, columnToTypeTypeScript, pascalToKebabCase } from "../module-buillders";
import { columnToFieldJava } from "../sql-datastructs/datastructs";

export async function buildAngularFormFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const moduleNameKebab = pascalToKebabCase(moduleName);
  const columns = schema.columns;
  const primaries = columns.filter(col => col.isPrimary);

  const declareFormFields = columns.map(field => {
    const fieldName = columnToFieldJava(field.column);
    const fieldNamePascal = columnToPascalFieldJava(field.column);
    const fieldType = columnToTypeTypeScript(field, dialect);
    if (field.uiComponent === 'autoComplete') {
      return `${fieldName}: this.fb.control({} as ${fieldNamePascal}${field.isNullable ? '' : ', [Validators.required, AutocompleteValidator.required()]'}),`;
    } else
      return `${fieldName}: this.fb.control<${fieldType}>(''${ fieldType != 'string' ? ' as any' : '' }${field.isNullable ? '' : ', Validators.required'}),`;
  });

  const disableFields = primaries.map(p => `'${p.javaFieldName}'`).join(', ');
  const disableFieldsDeclaration = `\n    [${disableFields}].map(f => this.form.get(f)?.disable());`;

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
import { NgxMaskDirective } from 'ngx-mask';

@Component({
  selector: 'app-${moduleNameKebab}-form',
  imports: [FormsModule, ReactiveFormsModule, MaterialModule, NgxMaskDirective],
  templateUrl: '${moduleNameKebab}-form.component.html',
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

  readonly entityId = this.route.snapshot.params.id ?? '';
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
    this.form.patchValue({ ...entity, ...nullEntity });${disableFieldsDeclaration}
  }

  async onSubmit() {
    this.trimFields();
    if (this.form.valid) {
      const entity = {
        ...this.form.getRawValue(),
        ...this.normalizeControlsDate(${columns.filter(c => c.javaType === 'LocalDate').map(c => `'${c.javaFieldName}'`).join(', ')})
      } as ${moduleName};
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

  normalizeControlsDate(...controls: string[]) {
    return Object.fromEntries(
      Object.entries(this.form.controls)
      .filter(c => controls.includes(c[0]) && c[1].value != '' && c[1] != null)
      .map(c => [c[0], \`\${c[1].value}T00:00:00\`])
    );
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
