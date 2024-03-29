import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";

export class LayoutForm extends Layout {

    public async init() {
        console.debug('LayoutForm::init');
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
        console.debug('LayoutForm::refresh');

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
        console.debug('LayoutForm::layout');
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

            if(group.hasOwnProperty('sections') && group.sections.length > 0) {
                let selected_section = 0;
                if(view_config && view_config.hasOwnProperty('selected_sections') && view_config.selected_sections.hasOwnProperty(i)) {
                    selected_section = view_config.selected_sections[i];
                }

                let $tabs = UIHelper.createTabBar('sections-'+group_id, '', '').addClass('sb-view-form-sections-tabbar');

                if(group.sections.length > 1 ||  group.sections[0].hasOwnProperty('label')){
                    $group.append($tabs);
                }

                if(group.hasOwnProperty('visible')) {
                    $group.attr('data-visible', JSON.stringify(group.visible));
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

                                if(item.hasOwnProperty('align') && item.align == 'right') {
                                    $cell.css({'margin-left': 'auto'});
                                }

                                if(item.hasOwnProperty('type') && item.hasOwnProperty('value')) {

                                    if(item.type == 'field') {
                                        let config = WidgetFactory.getWidgetConfig(this.view, item.value, translation, model_fields, view_fields);
                                        if(config) {
                                            let widget: Widget = WidgetFactory.getWidget(this, config.type, config.title, '', config);
                                            widget.setReadonly(config.readonly);
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

                if(group.sections.length > 1) {
                    UIHelper.decorateTabBar($tabs);
                }
            }
        });

        this.$layout.append($elem);
    }

    protected async feed(objects: any) {
        console.debug('LayoutForm::feed', objects);
        // display the first object from the collection

        let fields = Object.keys(this.view.getViewFields());
        let model_fields = this.view.getModelFields();
        let translation = this.view.getTranslation();
        const user = this.view.getUser();

        // remember which element has focus (DOM is going to be modified)
        let focused_widget_id = $("input:focus").closest('.sb-widget').attr('id');

        if(objects.length > 0) {
            // #todo - keep internal index of the object to display (with a prev/next navigation in the header)
            let object:any = objects[0];

            // update actions in view header
            let view_schema = this.view.getViewSchema();
            let $view_actions = this.view.getContainer().find('.sb-view-header-actions-view').first();

            // show object status, if defined and present
            if(model_fields.hasOwnProperty('status')) {
                let $status_container = $view_actions.find('#'+this.uuid+'_status');
                if($status_container.length == 0) {
                    let status_title = TranslationService.resolve(translation, 'model', [], 'status', 'status', 'label');
                    $status_container = $('<div style="margin-left: auto;"></div>').attr('id', this.uuid+'_status').append( $('<span style="line-height: 46px;margin-right: 12px; text-transform: capitalize;">'+status_title+': <span class="status-value"></span></span>') ).appendTo($view_actions);
                }

                let translated = TranslationService.resolve(translation, 'model', [], 'status', model_fields['status'].selection, 'selection');
                let status_selection = translated;
                // normalize translation map
                if(Array.isArray(translated)) {
                    // convert array to a Map (original values as keys and translations as values)
                    status_selection = {};
                    for(let i = 0, n = model_fields['status'].selection.length; i < n; ++i) {
                        status_selection[model_fields['status'].selection[i]] = translated[i];
                    }
                }
                let status_value = status_selection[object['status']];
                $status_container.find('.status-value').empty().append($('<b>'+status_value+'</b>'));
            }

            if(view_schema.hasOwnProperty('actions')) {
                // filter actions and keep only visible ones (based on 'visible' and 'access' properties)
                let actions = [];
                for(let action of view_schema.actions) {
                    let visible = true;
                    if(action.hasOwnProperty('visible')) {
                        // visible attribute is a Domain
                        if(Array.isArray(action.visible)) {
                            let domain = new Domain(action.visible);
                            visible = domain.evaluate(object, user);
                        }
                        else {
                            visible = <boolean>action.visible;
                        }
                    }
                    if(visible && action.hasOwnProperty('access') && action.access.hasOwnProperty('groups') && Array.isArray(action.access.groups)) {
                        visible = false;
                        if(user.hasOwnProperty('groups') && Array.isArray(user.groups)) {
                            for(let group of user.groups) {
                                if(action.access.groups.indexOf(group) >= 0) {
                                    visible = true;
                                    break;
                                }
                            }
                        }
                    }
                    if(visible) {
                        actions.push(action);
                    }
                }

                // retrieve previously created elements, if any
                $view_actions.find('#'+this.uuid+'_actions-button').remove();
                $view_actions.find('#'+this.uuid+'_actions-dropdown').remove();

                // there is a single action: show it as a button
                if(actions.length == 1) {
                    let action = actions[0];
                    let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                    let $action_button = UIHelper.createButton(this.uuid+'_actions-button', action_title, 'outlined');
                    $view_actions.append($action_button);
                    this.decorateActionButton($action_button, action, object);
                }
                // there are several actions: display a dropdown
                else if(actions.length > 1) {
                    let $actions_dropdown = UIHelper.createDropDown(this.uuid+'_actions-dropdown', 'Actions', 'text', '', '').addClass('layout-actions');
                    $view_actions.append($actions_dropdown);
                    let $menu_list = $actions_dropdown.find('.menu-list');
                    // keep track of empty lists
                    for(let action of actions) {
                        let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                        let item_id = this.uuid+'_action-'+(''+action.id).replace(/\./g,'_');
                        let $item = UIHelper.createListItem(item_id, action_title);
                        $menu_list.append($item);
                        this.decorateActionButton($item, action, object);
                    }
                }
            }

            // update groups visibility, if any
            let $groups = this.$layout.find('.sb-view-form-group');
            $groups.each( (i:number, elem:any) => {
                let $group = $(elem);
                let visible = $group.attr('data-visible');
                if(visible != undefined) {
                    if(visible == 'false') {
                        $group.hide();
                    }
                    else {
                        let domain = new Domain(JSON.parse(visible));
                        if(domain.evaluate(object, user)) {
                            $group.show();
                        }
                        else {
                            $group.hide();
                        }
                    }
                }
            });

            // update tabs visibility, if any
            // #todo - handle standalone sections
            let $tabs = this.$layout.find('.mdc-tab.sb-view-form-section-tab');
            $tabs.each( (i:number, elem:any) => {
                let $tab = $(elem);
                let visible = $tab.attr('data-visible');
                if(visible != undefined) {
                    if(visible == 'false') {
                        $tab.hide();
                    }
                    else {
                        let domain = new Domain(JSON.parse(visible));
                        if(domain.evaluate(object, user)) {
                            $tab.show();
                        }
                        else {
                            $tab.hide();
                        }
                    }
                }
            });

            for(let widget_index of Object.keys(this.model_widgets[0])) {

                let widget = this.model_widgets[0][widget_index];
                // widget might be missing (if not visible)
                if(!widget) {
                    continue;
                }

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
                    let $parent = this.$layout.find('#'+widget.getId()).parent();
                    if(!visible) {
                        $parent.empty().append(widget.attach()).hide();
                    }
                    else {
                        $parent.empty().append(widget.render()).show();
                    }
                }
                else {

                    let field = config.field;

                    let $parent = this.$layout.find('#'+widget.getId()).parent();

                    let type = this.view.getModel().getFinalType(field);

                    let has_changed = false;
                    let value = (object.hasOwnProperty(field))?object[field]:undefined;


                    // for relational fields, we need to check if the Model has been fetched
                    if(['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {
                        // if widget has a domain, parse it using current object and user
                        if(config.hasOwnProperty('original_domain')) {
                            let tmpDomain = new Domain(config.original_domain);
                            config.domain = tmpDomain.parse(object, user).toArray();
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
                                        config.header.actions[id][index].domain = tmpDomain.parse(object, user).toArray();
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

                    // #todo - systematize the way change is transmitted
                    has_changed = (!value || $parent.data('value') != JSON.stringify(value));
                    if(widget.config.hasOwnProperty('changed') && widget.config.changed) {
                        has_changed = true;
                        widget.config.changed = false;
                    }

                    widget.setConfig({...config, ready: true})
                    .setMode(this.view.getMode())
                    .setValue(value);

                    // store data to parent, for tracking changes at next refresh (prevent storing references)
                    $parent.data('value', JSON.stringify(value) || null);

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
                            let model_fields:any = {};
                            // if value is less than 1k, relay onchange to server
                            // #todo - choose an objectivable limit
                            if(String(widget.getValue()).length < 1000) {
                                // relay the change to back-end through onupdate
                                try {
                                    // #todo - add support for dynamic schema (ex. filter or update selection of selectable fields, based on value from other fields)
                                    const result = await ApiService.call("?do=model_onchange", {entity: this.view.getEntity(), changes: this.view.getModel().export(values), values: this.view.getModel().export(object), lang: this.view.getLang()} );
                                    if (typeof result === 'object' && result != null) {
                                        for(let field of Object.keys(result)) {
                                            // there are changes to apply on the schema: we must force a re-feed on the Form
                                            refresh = true;
                                            // if some changes are returned from the back-end, append them to the view model update
                                            if(typeof result[field] === 'object' && result[field] !== null) {
                                                if(result[field].hasOwnProperty('value')) {
                                                    values[field] = result[field].value;
                                                }
                                                else {
                                                    values[field] = result[field];
                                                }
                                                model_fields[field] = result[field];
                                            }
                                            else {
                                                values[field] = result[field];
                                            }
                                        }
                                    }
                                }
                                catch(response) {
                                    // ignore faulty responses
                                    console.warn('unable to send onchange request', response);
                                }
                            }
                            // update model schema of the view if necessary
                            if(Object.keys(model_fields).length > 0) {
                                // we need to retrieve the widget based on the field name
                                for(let widget_index of Object.keys(this.model_widgets[0])) {
                                    let widget = this.model_widgets[0][widget_index];
                                    let field = widget.config.field;
                                    if(model_fields.hasOwnProperty(field)) {
                                        for(let property of Object.keys(model_fields[field])) {
                                            widget.config[property] = model_fields[field][property];
                                            widget.config.changed = true;
                                        }
                                    }
                                }
                            }
                            this.view.onchangeViewModel([object.id], values, refresh);
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
            $('#'+focused_widget_id).find('input').trigger('focus');
        }

    }

}