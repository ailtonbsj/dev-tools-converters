import { pascalToCamelCase, pascalToKebabCase } from "../case-util";
import { DatabaseTable, Dialect } from "../sql-datastructs/database.model";

export async function buildAngularDataTableFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const moduleNameKebab = pascalToKebabCase(moduleName);
  const moduleNameCamel = pascalToCamelCase(moduleName);
  const columns = schema.columns;

  const columnsMenuDeclaration = columns.map(c => {
    return `{ id: '${c.javaFieldName}', label: '${c.label}', enabled: true },`;
  });

  const datatableTemplate = `
import { AfterViewInit, Component, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from 'src/app/shared/material.module';
import { Page } from 'src/app/shared/models/page.model';
import { PageEvent } from '@angular/material/paginator';
import { PageControl } from 'src/app/shared/models/page-control.model';
import { firstValueFrom, Observable } from 'rxjs';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { SpinnerTextService } from 'src/app/shared/services/spinner-text.service';
import { MatSort, Sort } from '@angular/material/sort';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SortIconComponent } from 'src/app/components/sort-icon/sort-icon.component';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MatSelectionList } from '@angular/material/list';
import { ConfirmDialogComponent } from 'src/app/shared/components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogData } from 'src/app/shared/components/confirm-dialog/confirm-dialog-data.model';
import { MatDialog } from '@angular/material/dialog';
import { ViewState } from 'src/app/shared/models/dialog-data.model';
import { ${moduleName} } from '../${moduleNameKebab}.model';
import { ${moduleName}Service } from '../${moduleNameKebab}.service';
import { ${moduleName}FormComponent } from '../${moduleNameKebab}-form/${moduleNameKebab}-form.component';
import { ${moduleName}DialogData } from '../${moduleNameKebab}-form-data.model';

@Component({
  selector: 'app-${moduleNameKebab}-datatable',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MaterialModule, SortIconComponent, DatePipe, CurrencyPipe],
  templateUrl: '${moduleNameKebab}-datatable.component.html',
  styleUrl: '${moduleNameKebab}-datatable.component.scss'
})
export class ${moduleName}DataTableComponent implements AfterViewInit {

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spinnerText = inject(SpinnerTextService);
  private alert = inject(AlertService);
  private dialog = inject(MatDialog);
  private ${moduleNameCamel}Service = inject(${moduleName}Service);

  form${moduleName} = this.fb.group({
    ${columns.map(c => c.javaFieldName + ': [\'\'],').join('\n    ')}
  });

  isFirst${moduleName}Search = true;
  enable${moduleName}Search = false;
  is${moduleName}Loading = false;

  datasource${moduleName} = new MatTableDataSource(<${moduleName}[]>[]);
  display${moduleName}Footer = ['footer'];
  columns${moduleName}: { id: string, label: string, enabled: boolean }[] = [
    ${columnsMenuDeclaration.join('\n    ')}
  ];
  displayed${moduleName}Columns: string[] = [
    ...this.columns.filter(c => c.enabled).map(c => c.id), 'actions'
  ];

  readonly dataNotFound = 'Não informado!';

  entity${moduleName} = <${moduleName}>{};
  ${moduleNameCamel}Page = <Page<${moduleName}>>{ size: 10 };
  page${moduleName}Ctl: PageControl = <PageControl>{
    pageNumber: 0,
    pageSize: 10,
    directions: '',
    sortProps: '',
  };

  @ViewChild(MatSort) sortViewChild${moduleName}: MatSort = <MatSort>{};
  sorts${moduleName} = signal<{ active: string, direction: string }[]>([]);

  ngAfterViewInit(): void {
    init${humanName}Datatable()
  }

  onColumnMenuClick(list: MatSelectionList) {
    const selected = list.selectedOptions.selected.map(i => i.value);
    this.displayedColumns = this.columns.filter(c => selected.includes(c.id)).map(c => c.id);
    this.displayedColumns.push('actions');
  }

  onSubmit() {
    this.trimFields();
    if (this.form.valid) {
      this.pageCtl.pageNumber = 0;
      this.entity = <${moduleName}>{
        ...this.form.value as any,
        ...this.normalizeControlsFloat(${columns.filter(c => ['BigDecimal', 'Double', 'Float'].includes(c.javaType)).map(c => `'${c.javaFieldName}'`).join(', ')})
      };
      this.isFirst${moduleName}Search = false;
      this.enable${moduleName}Search = true;
      this.search${moduleName}();
    }
  }

  normalizeControlsFloat(...controls: string[]) {
    return Object.fromEntries(
      Object.entries(this.form.controls)
      .filter(c => controls.includes(c[0]) && c[1].value != '' && c[1] != null)
      .map(c => [c[0], c[1].value?.replace(/R|\\$|\\./g, '').replace(',', '.') ?? ''])
    );
  }

  trimFields() {
    Object.keys(this.form.value)
      .map(f => this.form.get(f))
      .filter(f => typeof f?.value === 'string')
      .map(f => f?.setValue(f?.value.trim()));
  }

  async search${moduleName}() {
    if (!this.enable${moduleName}Search) return;
    this.enable${moduleName}Search = false;
    this.is${moduleName}Loading = true;
    this.spinnerText.show('Carregando dados da tabela ...');
    try {
      const page = await firstValueFrom(this.${moduleNameCamel}Service.filter(this.entity${moduleName}, this.page${moduleName}Ctl));
      this.display${moduleName}Footer = page.content?.length !== 0 ? [] : ['footer'];
      this.${moduleName}Page = page;
      this.datasource${moduleName} = new MatTableDataSource(this.entityPage.content);
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse) {
        if (e.status === HttpStatusCode.NotFound) {
          this.alertWarn(e.error.message);
        } else if (e.status === HttpStatusCode.BadRequest) {
          this.alertWarn(e.error.message);
        } else console.log(e);
      } else console.log(e);
    }
    this.spinnerText.hide();
    this.is${moduleName}Loading = false;
    this.enable${moduleName}Search = true;
  }

  onPage${moduleName}Change(event: PageEvent) {
    this.page${moduleName}Ctl.pageNumber = event.pageIndex;
    this.page${moduleName}Ctl.pageSize = event.pageSize;
    this.search${moduleName}();
  }

  clearForm${moduleName}() {
    this.form${moduleName}.reset({
      ${columns.map(c => c.javaFieldName + ': \'\',').join('\n      ')}
    });
    this.enable${moduleName}Search = false;
    this.isFirst${moduleName}Search = true;
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

  async showNew${moduleName}Form() {
    this.router.navigate([\`./novo\`], { relativeTo: this.route });
    // this.showFormDialog();
  }

  async showEdit${moduleName}Form(id: string) {
    this.router.navigate([\`./\${id}/edicao\`], { relativeTo: this.route });
    // this.showFormDialog('edicao', id);
  }

  async showReadOnly${moduleName}Form(id: string) {
    this.router.navigate([\`./\${id}\`], { relativeTo: this.route });
    // this.showFormDialog('leitura', id);
  }

  async show${moduleName}FormDialog(viewState: ViewState = 'novo', id?: string) {
    const dialogRef = this.dialog.open(${moduleName}FormComponent, {
      const data: ${moduleName}DialogData = { viewState, id };
      disableClose: true,
      minWidth: '800px',
      data
    });
    const item = await firstValueFrom<${moduleName}>(dialogRef.afterClosed());
    if(item != null) this.search();
  }

  confirmDelete(): Observable<boolean> {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '500px',
      data: {
        title: 'Confirmação de exclusão',
        messages: ['Esta ação não poderá ser desfeita.', 'Deseja realmente excluir esse registro?'],
        okLabel: 'Excluir',
        okIcon: 'delete',
        okColor: 'warn'
      } as ConfirmDialogData,
    });
    return dialogRef.afterClosed();
  }

  async confirmRemove${moduleName}(id: number) {
    try {
      if(await firstValueFrom(this.confirmDelete())) {
        await firstValueFrom(this.service.destroy(id));
        this.alertSuccess(\`${humanName} com ID \${id} excluído com sucesso!\`);
        this.search();
      }
    } catch (e: unknown) {
      if (e instanceof HttpErrorResponse) {
        if (e.status === HttpStatusCode.BadRequest) {
          this.alertWarn(e.error.message);
        } else console.log(e);
      } else console.log(e);
    }
  }

  async init${humanName}Datatable() {
    this.sortViewChild${humanName}.sortChange.subscribe({
      next: (sort: Sort) => {
        const item = this.sorts${humanName}().find(o => o.active === sort.active);
        if (item) {
          if (sort.direction !== '') item.direction = sort.direction;
          else this.sorts${humanName}.set(this.sorts().filter(o => o.active != item.active));
        } else {
          if (sort.direction !== '') {
            const sortsArr = this.sorts${humanName}();
            sortsArr.push(sort);
            this.sorts${humanName}.set(sortsArr);
          }
        }
        const sortProps = this.sorts${humanName}().map(o => o.active).join(',');
        const directions = this.sorts${humanName}().map(o => o.direction).join(',');
        if (sortProps !== this.page${humanName}Ctl.sortProps || directions !== this.page${humanName}Ctl.directions) {
          this.page${humanName}Ctl.sortProps = sortProps;
          this.page${humanName}Ctl.directions = directions;
          this.search${humanName}();
        }
      }
    });
  }

}
`;
  return datatableTemplate;
}
