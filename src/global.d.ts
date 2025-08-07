/** From MDL */
declare var componentHandler: any;

// declare function moment(date: any): any;



/** From JQuery custom widgets */
interface JQuery {
    daterangepicker(options?: any, callback?: Function) : any;
    timepicker(options?: any, callback?: Function) : any;
}

declare module 'quill-better-table' {
  import Quill from 'quill';

  export default class QuillBetterTable {
    constructor(quill: Quill, options: any);
  }
}