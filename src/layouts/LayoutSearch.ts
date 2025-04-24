import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";

/**
 * Special layout for advanced search input forms.
 */
export class LayoutSearch extends Layout {

    public async init() {
        console.debug('LayoutSearch::init');
        try {
            // initialize the layout
            this.layout();
        }
        catch(err) {
            console.warn('Something went wrong ', err);
        }
    }

    // refresh layout
    // this method is called in response to parent View `onchangeModel` method
    public async refresh(full: boolean = false) {
        console.debug('LayoutSearch::refresh');

        // also re-generate the layout
        if(full) {
            this.$layout.empty();
            this.layout();
        }

        // feed layout with current Model
        let objects = await this.view.getModel().get();
        this.feed(objects);
    }

    /**
     *
     * This method also stores the list of instantiated widgets to allow switching from view mode to edit mode  (for a form or a cell)
     *
     */
    protected layout() {
        console.debug('LayoutSearch::layout');
        let $elem = $('<div/>').css({"width": "100%"});

        let view_schema = this.view.getViewSchema();

        let view_fields = this.view.getViewFields();
        let model_fields = this.view.getModelFields();

        let translation = this.view.getTranslation();
        let view_config = this.view.getConfig();

        if(!view_schema.hasOwnProperty('layout') || !view_schema.layout.hasOwnProperty('groups')) {
            console.warn("invalid layout, stop processing");
            return;
        }

        $.each(view_schema.layout.groups, (i:number, group) => {
            let group_id = 'group-'+i;
            let $group = $('<div />').addClass('sb-view-form-group').appendTo($elem);

            // try to resolve the group title
            let group_title = (group.hasOwnProperty('label'))?group.label:'';
            if(group.hasOwnProperty('id')) {
                group_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], group.id, group_title);
            }
            // append the group title, if any
            if(group_title.length) {
                $group.append($('<div/>').addClass('sb-view-form-group-title').text(group_title));
            }

            let selected_section = 0;
            if(view_config && view_config.hasOwnProperty('selected_sections') && view_config.selected_sections.hasOwnProperty(i)) {
                selected_section = view_config.selected_sections[i];
            }

            let $tabs = UIHelper.createTabBar('sections-'+group_id, '', '').addClass('sb-view-form-sections-tabbar');

            if(group.sections.length > 1 ||  group.sections[0].hasOwnProperty('label')){
                $group.append($tabs);
            }

            $.each(group.sections, (j:number, section) => {
                let section_id = group_id+'-section-'+j;

                let $section = $('<div />').attr('id', section_id).addClass('sb-view-form-section mdc-layout-grid').appendTo($group);

                if(j != selected_section) {
                    $section.hide();
                }

                if(group.sections.length > 1 || section.hasOwnProperty('label')) {
                    // try to resolve the section title
                    let section_title = (section.hasOwnProperty('label'))?section.label:section_id;
                    if(section.hasOwnProperty('id')) {
                        section_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], section.id, section_title);
                    }

                    let $tab = UIHelper.createTabButton(section_id+'-tab', section_title, (j == selected_section)).addClass('sb-view-form-section-tab')
                    .on('click', () => {
                        $group.find('.sb-view-form-section').hide();
                        $group.find('#'+section_id).show();
                    });

                    if(section.hasOwnProperty('visible')) {
                        $tab.attr('data-visible', JSON.stringify(section.visible));
                    }

                    $tabs.find('.sb-view-form-sections').append($tab);
                }


                $.each(section.rows, (k:number, row) => {
                    let $row = $('<div />').addClass('sb-view-form-row mdc-layout-grid__inner').appendTo($section);
                    $.each(row.columns, (l:number, column) => {
                        let $column = $('<div />').addClass('mdc-layout-grid__cell').appendTo($row);

                        if(column.hasOwnProperty('width')) {
                            $column.addClass('mdc-layout-grid__cell--span-' + Math.round((parseInt(column.width, 10) / 100) * 12));
                        }

                        if(column.hasOwnProperty('align') && column.align == 'right') {
                            $column.css({'margin-left': 'auto'});
                        }

                        let $inner_cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                        $column = $('<div />').addClass('mdc-layout-grid__inner').appendTo($inner_cell);

                        $.each(column.items, (i, item) => {
                            if(typeof this.model_widgets[0] == 'undefined') {
                                this.model_widgets[0] = {};
                            }

                            let $cell = $('<div />').addClass('mdc-layout-grid__cell').appendTo($column);
                            // compute the width (on a 12 columns grid basis), from 1 to 12
                            let width = (item.hasOwnProperty('width'))?Math.round((parseInt(item.width, 10) / 100) * 12): 12;
                            $cell.addClass('mdc-layout-grid__cell--span-' + width);

                            if(item.hasOwnProperty('type') && item.hasOwnProperty('value')) {

                                if(item.type == 'field') {
                                    let config = WidgetFactory.getWidgetConfig(this.view, item.value, translation, model_fields, view_fields);
                                    if(config) {
                                        config.has_action_create = false;
                                        config.has_action_open = false;
                                        let widget: Widget = WidgetFactory.getWidget(this, config.type, config.title, '', config);
                                        widget.setMode(this.view.getMode());

                                        // store widget in widgets Map, using field name as key
                                        this.model_widgets[0][item.value] = widget;
                                        $cell.append(widget.attach());
                                    }
                                }
                                else if(item.type == 'label') {
                                    let label_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], item.id, item.value);
                                    let widget:Widget = WidgetFactory.getWidget(this, 'label', '', label_title, {widget_type: 'label', ...item});
                                    this.model_widgets[0]['__label_'+widget.getId()] = widget;
                                    $cell.append(widget.render());
                                }
                            }
                        });
                    });
                });
            });
            UIHelper.decorateTabBar($tabs);
        });

        this.$layout.append($elem);

    }

    protected async feed(objects: any) {
        console.debug('LayoutSearch::feed', objects);

        // display the first object from the collection

        let fields = Object.keys(this.view.getViewFields());
        let model_fields = this.view.getModelFields();
        const user = this.view.getUser();

        // remember which element has focus (DOM is going to be modified)
        let focused_widget_id = $("input:focus").closest('.sb-widget').attr('id');

        if(objects.length > 0) {
            // #todo - keep internal index of the object to display (with a prev/next navigation in the header)
            let object:any = objects[0];

            // update actions in view header
            let view_schema = this.view.getViewSchema();

            // update tabs visibility, if any
            let $tabs = this.$layout.find('.mdc-tab.sb-view-form-section-tab');
            $tabs.each( (i:number, elem:any) => {
                let $tab = $(elem);
                let visible = $tab.attr('data-visible');
                if(visible != undefined) {
                    let domain = new Domain(JSON.parse(visible));
                    if(domain.evaluate(object)) {
                        $tab.show();
                    }
                    else {
                        $tab.hide();
                    }
                }
            });

            for(let widget_index of Object.keys(this.model_widgets[0])) {

                let widget = this.model_widgets[0][widget_index];
                let config = widget.getConfig();

                if( config['widget_type'] == 'label') {
                    let visible = true;
                    // handle visibility tests (domain)
                    if(config.hasOwnProperty('visible')) {
                        // visible attribute is a Domain
                        if(Array.isArray(config.visible)) {
                            let domain = new Domain(config.visible);
                            visible = domain.evaluate(object, user);
                        }
                        else {
                            visible = <boolean>config.visible;
                        }
                    }
                    let $parent = this.$layout.find('#' + widget.getId()).parent();
                    if(!visible) {
                        $parent.empty().append(widget.attach()).hide();
                    }
                    else {
                        $parent.empty().append(widget.render()).show();
                    }
                }
                else {

                    let field = config.field;
                    // widget might be missing (if not visible)
                    if(!widget) {
                        continue;
                    }

                    let $parent = this.$layout.find('#'+widget.getId()).parent();

                    let type = this.view.getModel().getFinalType(field) || 'string';

                    let has_changed = false;
                    let value = (object.hasOwnProperty(field))?object[field]:undefined;


                    // for relational fields, we need to check if the Model has been fetched
                    if(['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {
                        // if widget has a domain, parse it using current object and user
                        if(config.hasOwnProperty('original_domain')) {
                            let tmpDomain = new Domain(config.original_domain);
                            config.domain = tmpDomain.parse(object, user, {}, this.getEnv()).toArray();
                        }
                        else {
                            config.domain = [];
                        }

                        // if widget has a custom header definition, parse subsequent domains, if any
                        if(config.hasOwnProperty('header') && config.header.hasOwnProperty('actions') ) {
                            for (const [id, items] of Object.entries(config.header.actions)) {
                                for(let index in (<Array<any>>items)) {
                                    let item = (<Array<any>>items)[<any>index];
                                    if(item.hasOwnProperty('domain')) {
                                        let tmpDomain = new Domain(item.domain);
                                        config.header.actions[id][index].domain = tmpDomain.parse(object, user, {}, this.getEnv()).toArray();
                                    }
                                }
                            }
                        }

                        // by convention, `name` subfield is always loaded for relational fields
                        if(type == 'many2one') {
                            if(object[field]) {
                                value = object[field]['name'];
                                config.object_id = object[field]['id'];
                            }
                            // config.object_id might have been modified by selection : remove it if not present or empty
                            else if(config.hasOwnProperty('object_id')) {
                                delete config.object_id;
                            }
                        }
                        else if(type == 'many2many' || type == 'one2many') {
                            // init field if not present yet (o2m and m2m are not loaded by Model)
                            if(!object.hasOwnProperty(field)) {
                                object[field] = [];
                                // force change detection (upon re-feed, the field do not change and remains an empty array)
                                $parent.data('value', null);
                            }

                            // for m2m fields, the value of the field is an array of ids
                            // by convention, when a relation is to be removed, the id field is set to its negative value
                            value = object[field];

                            // select ids to load by filtering targeted objects
                            config.ids_to_add = object[field].filter( (id:number) => id > 0 );
                            config.ids_to_del = object[field].filter( (id:number) => id < 0 ).map( (id:number) => -id );

                            // we need the current object id for new objects creation
                            config.object_id = object.id;
                        }
                    }

                    has_changed = (!value || $parent.data('value') != JSON.stringify(value));

                    widget.setConfig({...config, ready: true})
                        .setMode(this.view.getMode())
                        .setValue(value);

                    // store data to parent, for tracking changes at next refresh (prevent storing references)
                    $parent.data('value', JSON.stringify(value) || null);

                    let visible = true;
                    // handle visibility tests (domain)
                    if(config.hasOwnProperty('visible')) {
                        visible = this.isVisible(config.visible, object, user, {}, this.getEnv());
                    }

                    if(!visible) {
                        $parent.empty().append(widget.attach()).hide();
                        // visibility update need to trigger a redraw, whatever the value (so we change it to an arbitrary value)
                        $parent.data('value', null);
                    }
                    else {
                        let $widget = widget.render();
                        // Handle Widget update handler
                        $widget.on('_updatedWidget', async (event:any, refresh: boolean = true) => {
                            console.debug("Layout::feedForm : received _updatedWidget", field, widget.getValue(), refresh);
                            // update object with new value
                            let values:any = {};
                            values[field] = widget.getValue();
                            // update model without refreshing the view
                            this.view.onchangeViewModel([object.id], values, true);
                        });
                        // prevent refreshing objects that haven't changed
                        if(has_changed) {
                            // append rendered widget
                            $parent.empty().append($widget).show();
                        }
                    }
                }
            }
            // try to give the focus back to the previously focused widget
            // #memo - this is not relevant here and leads to datepicker popup re-opening
            // $('#'+focused_widget_id).find('input').trigger('focus');
        }

    }

}