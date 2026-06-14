import { DatabaseTable } from "../database-table.model";
import { columnToFieldJava, Dialect, pascalToKebabCase } from "../module-buillders";

export async function buildAngularDataTableFromDdl(moduleName: string, humanName: string, schema: DatabaseTable, dialect: Dialect): Promise<string> {
  const moduleNameKebab = pascalToKebabCase(moduleName);
  const columns = schema.columns;

  const columnsMenuDeclaration = columns.map(c => {
    return `{ id: '${columnToFieldJava(c.column)}', label: '${c.label}', enabled: true },`;
  });

  const datatableTemplate = `
import { AfterViewInit, Component, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MaterialModule } from 'src/app/shared/material.module';
import { Page } from 'src/app/shared/models/page.model';
import { PageEvent } from '@angular/material/paginator';
import { PageControl } from 'src/app/shared/models/page-control.model';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { SpinnerTextService } from 'src/app/shared/services/spinner-text.service';
import { MatSort, Sort } from '@angular/material/sort';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SortIconComponent } from 'src/app/components/sort-icon/sort-icon.component';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MatSelectionList } from '@angular/material/list';
import { ${moduleName} } from '../${moduleNameKebab}.model';
import { ${moduleName}Service } from '../${moduleNameKebab}.service';

@Component({
  selector: 'app-${moduleNameKebab}-datatable',
  imports: [CommonModule, RouterModule, ReactiveFormsModule, MaterialModule, SortIconComponent, DatePipe, CurrencyPipe],
  templateUrl: '${moduleNameKebab}-datatable.html',
  styleUrl: '${moduleNameKebab}-datatable.scss'
})
export class ${moduleName}DataTableComponent implements AfterViewInit {

  private fb = inject(FormBuilder);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private spinnerText = inject(SpinnerTextService);
  private alert = inject(AlertService);
  private service = inject(${moduleName}Service);

  form = this.fb.group({
    ${columns.map(c => columnToFieldJava(c.column) + ': [\'\'],').join('\n    ')}
  });

  isFirstSearch = true;
  enableSearch = false;
  isLoading = false;

  datasource = new MatTableDataSource(<${moduleName}[]>[]);
  displayFooter = ['footer'];
  columns: { id: string, label: string, enabled: boolean }[] = [
    ${columnsMenuDeclaration.join('\n    ')}
  ];
  displayedColumns: string[] = [
    ...this.columns.filter(c => c.enabled).map(c => c.id), 'actions'
  ];

  readonly dataNotFound = 'Não foi informado!';

  entity = <${moduleName}>{};
  entityPage = <Page<${moduleName}>>{ size: 10 };
  pageCtl: PageControl = <PageControl>{
    pageNumber: 0,
    pageSize: 10,
    directions: '',
    sortProps: '',
  };

  @ViewChild(MatSort) sortViewChild: MatSort = <MatSort>{};
  sorts = signal<{ active: string, direction: string }[]>([]);

  ngAfterViewInit(): void {
    this.sortViewChild.sortChange.subscribe({
      next: (sort: Sort) => {
        const item = this.sorts().find(o => o.active === sort.active);
        if (item) {
          if (sort.direction !== '') item.direction = sort.direction;
          else this.sorts.set(this.sorts().filter(o => o.active != item.active));
        } else {
          if (sort.direction !== '') {
            const sortsArr = this.sorts();
            sortsArr.push(sort);
            this.sorts.set(sortsArr);
          }
        }
        const sortProps = this.sorts().map(o => o.active).join(',');
        const directions = this.sorts().map(o => o.direction).join(',');
        if (sortProps !== this.pageCtl.sortProps || directions !== this.pageCtl.directions) {
          this.pageCtl.sortProps = sortProps;
          this.pageCtl.directions = directions;
          this.search();
        }
      }
    });
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
      };
      this.isFirstSearch = false;
      this.enableSearch = true;
      this.search();
    }
  }

  trimFields() {
    Object.keys(this.form.value)
      .map(f => this.form.get(f))
      .filter(f => typeof f?.value === 'string')
      .map(f => f?.setValue(f?.value.trim()));
  }

  async search() {
    if (!this.enableSearch) return;
    this.enableSearch = false;
    this.isLoading = true;
    this.spinnerText.show('Carregando dados da tabela ...');
    try {
      const page = await firstValueFrom(this.service.filter(this.entity, this.pageCtl));
      this.displayFooter = page.content?.length !== 0 ? [] : ['footer'];
      this.entityPage = page;
      this.datasource = new MatTableDataSource(this.entityPage.content);
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
    this.isLoading = false;
    this.enableSearch = true;
  }

  onPageChange(event: PageEvent) {
    this.pageCtl.pageNumber = event.pageIndex;
    this.pageCtl.pageSize = event.pageSize;
    this.search();
  }

  clearForm() {
    this.form.reset({
      ${columns.map(c => columnToFieldJava(c.column) + ': \'\',').join('\n      ')}
    });
    this.enableSearch = false;
    this.isFirstSearch = true;
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

  showForm(id: string) {
    this.router.navigate([\`./\${id}/edicao\`], { relativeTo: this.route });
  }

}
`;
  return datatableTemplate;
}
