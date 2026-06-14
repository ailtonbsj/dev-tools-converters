export async function buildAngularDataTableSCSSFromDdl() {

  return `
/* Fix Mat Table */

.table-border-brown {
  border-color: #dee2e6;
  margin: 0 !important;
}

.th-bold-center {
  font-size: 16px;
  font-weight: bold;
  vertical-align: middle;
  text-align: center;
}

.bg-color-lightbrown {
  background-color: #f2f2f2;
}

::ng-deep .mat-sort-header-container {
  display: flex;
  justify-content: center;
}

::ng-deep .mat-sort-header .mat-sort-header-arrow {
  display: none !important;
}

.datatable-panel {
  overflow-x: auto;
  scrollbar-width: 6px;
}

.datatable-panel::-webkit-scrollbar-thumb {
  background-color: #388e3c;
  border-radius: 6px;
}

.datatable-panel::-webkit-scrollbar {
  height: 6px;
}

::ng-deep .mat-mdc-menu-content {
    max-height: 450px !important;
}
`;

}
