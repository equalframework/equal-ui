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
import WidgetFile from "./widgets/WidgetFile";
import WidgetImage from "./widgets/WidgetImage";
import WidgetOne2Many  from "./widgets/WidgetOne2Many";
import WidgetMany2One  from "./widgets/WidgetMany2One";
import WidgetMany2Many  from "./widgets/WidgetMany2Many";

import { View, Layout } from "./equal-lib";

import { TranslationService } from "./equal-services";
import { Domain, Clause, Condition } from "./Domain";

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
     * Widget factory : maps type guessed from model and view schema with a specific widget.
     * @param type
     * @param value
     */
    public static getWidget(parent:Layout | View, type: string, label: string, value: any = null, config:any = {}): Widget {
        let view_type, layout;

        if(parent instanceof Layout) {
            layout = parent;
            view_type = layout.getView().getType();
        }
        else {
            layout = new Layout(parent);
            view_type = parent.getType();
        }

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
            case 'link':
                return new WidgetLink(layout, label, value, config);
            case 'binary':
            case 'file':
                if(config.hasOwnProperty('usage') && config.usage.substring(0, 5) == 'image') {
                    return new WidgetImage(layout, label, value, config);
                }
                return new WidgetFile(layout, label, value, config);
            case 'text':
                if(view_type == 'list') {
                    return new WidgetString(layout, label, value, config);
                }
                return new WidgetText(layout, label, value, config);    
            case 'string':
                if(config.hasOwnProperty('usage') && config.usage == 'string/text' && view_type == 'form') {
                    return new WidgetText(layout, label, value, config);
                }
            default:
                return new WidgetString(layout, label, value, config);
        }
    }


    /**
     * Generate a widget config based on a layout item (from View schema)
     * 
     * @param {View} view           View    field
     * @param {string} field        Field name.
     * @param {any} translation     View translation map.
     * @param {any} model_fields    Associative array mapping fields with their model definition.
     * @param {string} view_fields  Associative array mapping fields with their view definition.
     * @return {}                   Returns a widget configuration object.
     */
    public static getWidgetConfig(view: View, field: string, translation: any, model_fields: any, view_fields: any) :any {
        let config:any = {};

        let item = view_fields[field];

        if(!model_fields || !model_fields.hasOwnProperty(field)) {
            return null;
        }

        let def = model_fields[field];

        let label = (item.hasOwnProperty('label'))?item.label:field;
        // #todo - handle help and relay to Context
        let helper = (item.hasOwnProperty('help'))?item.help:(def.hasOwnProperty('help'))?def['help']:'';
        let description = (item.hasOwnProperty('description'))?item.description:(def.hasOwnProperty('description'))?def['description']:'';

        if(def.hasOwnProperty('type')) {
            let type = def['type'];
            if(def.hasOwnProperty('result_type')) {
                type = def['result_type'];
            }
            if(def.hasOwnProperty('usage')) {
                switch(def.usage) {
                    // #todo - complete the list
                    case 'text/plain':
                    case 'markup/html':
                        type = 'text';
                        break;
                    case 'uri/url:http':
                    case 'uri/url':
                        type = 'link';
                        break;
                    case 'image/gif':
                    case 'image/png':
                    case 'image/jpeg':
                        // binary alt
                        type = 'file';
                        break;
                }
            }
            config.type = type;
        }
        else {
            // we shouldn't end up here : malformed schema
            console.log('ERROR - malformed schema for field '+field);
            return config;
        }

        if(def.hasOwnProperty('usage')) {
            config.usage = def.usage;
        }

        if(def.hasOwnProperty('foreign_object')) {
            config.foreign_object = def.foreign_object;
        }

        if(def.hasOwnProperty('foreign_field')) {
            config.foreign_field = def.foreign_field;
        }

        if(def.hasOwnProperty('selection')) {
            config.selection = def.selection;
            config.type = 'select';
            let translated = TranslationService.resolve(translation, 'model', [], field, config.selection, 'selection');
            let values = translated;
            if(Array.isArray(translated)) {
                // convert array to a Map (original values as keys and translations as values)
                values = {};
                for(let i = 0, n = config.selection.length; i < n; ++i) {
                    values[config.selection[i]] = translated[i];
                }
            }
            config.values = values;
        }
        config.field = field;
        config.visible = true;
        // #memo - ready property is set to true during the 'feed' phase        
        config.ready = false;
        config.title = TranslationService.resolve(translation, 'model', [], field, label, 'label');
        config.description = TranslationService.resolve(translation, 'model', [], field, description, 'description');
        config.readonly = (def.hasOwnProperty('readonly'))?def.readonly:(item.hasOwnProperty('readonly'))?item['readonly']:false;
        config.align = (item.hasOwnProperty('align'))?item.align:'left';
        config.sortable = (item.hasOwnProperty('sortable') && item.sortable);

        config.layout = view.getType();
        config.lang = view.getLang();
        config.locale = view.getLocale();

        if(item.hasOwnProperty('widget')) {
            // overload config with widget config, if any
            config = {...config, ...item.widget};
        }

        if(def.hasOwnProperty('visible')) {
            config.visible = def.visible;
        }

        if(item.hasOwnProperty('visible')) {
            config.visible = item.visible;
        }

        // convert visible property to JSON
        config.visible = eval(config.visible);

        // for relational fields, we need to check if the Model has been fetched al
        if(['one2many', 'many2one', 'many2many'].indexOf(config.type) > -1) {
            // defined config for Widget's view with a custom domain according to object values
            let view_id = (config.hasOwnProperty('view'))?config.view:'list.default';
            let parts = view_id.split(".", 2);
            let view_type = (parts.length > 1)?parts[0]:'list';
            let view_name = (parts.length > 1)?parts[1]:parts[0];

            let def_domain = (def.hasOwnProperty('domain'))?def['domain']:[];
            let view_domain = (config.hasOwnProperty('domain'))?config['domain']:[];

            let domain = new Domain(def_domain);
            domain.merge(new Domain(view_domain));

            config = {...config,
                entity: def['foreign_object'],
                view_type: view_type,
                view_name: view_name,
                original_domain: domain.toArray()
            };

        }

        return config;
    }

}

export { WidgetFactory, Widget }