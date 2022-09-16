import WidgetMany2Many from "./WidgetMany2Many";
import Layout from "../layouts/Layout";

import { UIHelper } from '../material-lib';



export default class WidgetOne2Many extends WidgetMany2Many {


    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, label, value, config);
        this.rel_type = 'one2many';
    }

}