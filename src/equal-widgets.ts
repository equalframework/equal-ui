import Widget from "./widgets/Widget";

import WidgetBoolean from "./widgets/WidgetBoolean";
import WidgetDate from "./widgets/WidgetDate";
import WidgetDateTime from "./widgets/WidgetDateTime";
import WidgetInteger from "./widgets/WidgetInteger";
import WidgetFloat from "./widgets/WidgetFloat";
import WidgetString from "./widgets/WidgetString";
import WidgetText from "./widgets/WidgetText";
import WidgetLink from "./widgets/WidgetLink";
import WidgetSelect from "./widgets/WidgetSelect";
import WidgetOne2Many  from "./widgets/WidgetOne2Many";
import WidgetMany2One  from "./widgets/WidgetMany2One";
import WidgetMany2Many  from "./widgets/WidgetMany2Many";
import Layout from "./Layout";

class WidgetFactory {

    /*
    Widgets are based on final type either ORM types or special View types
    widgets support two modes : view & edit, and are responsible for rendering accordingly


    un widget à un type, un mode, une valeur (qui s'affiche selon le type et le mode)
    et des infos de décoration: un label et un helper (facultatif)

    les widgets sont liés à des éléments (layout items) qui ont un type propre (fields, label, button, ...)

    les widgets liés à d'autres éléments que des fields disposent d'un ID qui permet de faire le lien avec la View parente et les infos additionnelles (aide, traduction)


config: {
    id:
    helper:
    view:
    domain: 
}    
    */


/**
 * factory : maps type guessed from model and view schema with a specific widget
 * @param type 
 * @param value 
 */
    public static getWidget(layout:Layout, type: string, label: string, value: any = null, config:any = {}): Widget {
        let view_type = layout.getView().getType();
        switch(type) {
            case 'boolean':
                return new WidgetBoolean(layout, label, value, config);
            case 'date':
                return new WidgetDate(layout, label, value, config);
            case 'datetime':
                return new WidgetDateTime(layout, label, value, config);
            case 'one2many':
                return new WidgetOne2Many(layout, label, value, config);
            case 'many2one':
                return new WidgetMany2One(layout, label, value, config);
            case 'many2many':
                return new WidgetMany2Many(layout, label, value, config);
            case 'select':
                return new WidgetSelect(layout, label, value, config);
            case 'integer':
                return new WidgetInteger(layout, label, value, config);
            case 'float':
                return new WidgetFloat(layout, label, value, config);    
            case 'text':
                if(view_type == 'list') {
                    return new WidgetString(layout, label, value, config);
                }
                return new WidgetText(layout, label, value, config);    
            case 'link':
                return new WidgetLink(layout, label, value, config);    
            case 'string':
            default:
                return new WidgetString(layout, label, value, config);
        }
    }

}

export { WidgetFactory, Widget }