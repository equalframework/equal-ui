import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";

export class LayoutForm extends Layout {

    // #memo - used for keeping track of the currently selected widget (assigned when `focusin` or `click` events are triggered),
    // and for giving back the focus after a refresh
    public focused_widget_id: string | undefined;

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
            console.warn("invalid layout, stop processing", this.getView().getName());
            return;
        }

        $.each(view_schema.layout.groups, (i:number, group) => {
            let group_id = 'group-'+i;
            let $group = $('<div />').addClass('sb-view-form-group').appendTo($elem);

            // try to resolve the group title
            let group_title = (group.hasOwnProperty('label')) ? group.label : '';
            if(group.hasOwnProperty('id')) {
                let translated_group_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], group.id, group_title);
                if(translated_group_title == group_title) {
                    // no translation found, check default view
                    translated_group_title = TranslationService.resolve(translation, 'view', [this.view.getType()+'.default', 'layout'], group.id, group_title);
                }
                group_title = translated_group_title;
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

                $group.attr('data-sections_count', group.sections.length);

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
                        // #memo - being the first section is not enough : a visible attribute evaluated to false might still be present
                        $section.hide();
                    }

                    if(section.hasOwnProperty('visible')) {
                        $section.attr('data-visible', JSON.stringify(section.visible));
                    }

                    if(group.sections.length > 1 || section.hasOwnProperty('label')) {
                        // try to resolve the section title
                        let section_title = (section.hasOwnProperty('label')) ? section.label : section_id;
                        if(section.hasOwnProperty('id')) {
                            let translated_section_title = TranslationService.resolve(translation, 'view', [this.view.getId(), 'layout'], section.id, section_title);
                            if(translated_section_title == section_title) {
                                // no translation found, check default view
                                translated_section_title = TranslationService.resolve(translation, 'view', [this.view.getType()+'.default', 'layout'], section.id, section_title);
                            }
                            section_title = translated_section_title;
                        }

                        let $tab = UIHelper.createTabButton(section_id+'-tab', section_title, (j == selected_section))
                            .addClass((j == selected_section) ? 'is-active' : '')
                            .addClass('sb-view-form-section-tab')
                            .attr('data-section_id', section_id)
                            .on('click', () => {
                                $group.find('.sb-view-form-section').hide();
                                $group.find('.sb-view-form-section-tab').removeClass('is-active');
                                $group.find('#' + section_id).show();
                                $tab.addClass('is-active');
                            });

                        if(section.hasOwnProperty('visible')) {
                            $tab.attr('data-visible', JSON.stringify(section.visible));
                        }

                        $tabs.find('.sb-view-form-sections').append($tab);
                    }


                    $.each(section.rows, (k:number, row) => {
                        let $row = $('<div />').addClass('sb-view-form-row mdc-layout-grid__inner').appendTo($section);

                        if(row.hasOwnProperty('visible')) {
                            $row.attr('data-visible', JSON.stringify(row.visible));
                        }

                        $.each(row.columns, (l:number, column) => {
                            let $column = $('<div />').addClass('sb-view-form-column mdc-layout-grid__cell').appendTo($row);

                            if(column.hasOwnProperty('visible')) {
                                $column.attr('data-visible', JSON.stringify(column.visible));
                            }

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
                                // #memo - flex doesn't work here (we probably need an additional level)
                                // or it does but only if subitems are flex: 1
                                let $cell = $('<div />')/*.css({'display': 'flex', 'align-items': 'center'})*/.addClass('mdc-layout-grid__cell').appendTo($column);
                                // compute the width (on a 12 columns grid basis), from 1 to 12
                                let width = (item.hasOwnProperty('width')) ? Math.round((parseInt(item.width, 10) / 100) * 12) : 12;
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

        if(objects.length == 0) {
            let $viewHeader = this.view.getContainer().find('.sb-view-header').first();
            $viewHeader.empty();
            this.$layout.empty().append($('<div />').append($('<div />').css({ 'padding': '30px 20px', 'font-style': 'italic'}).text(TranslationService.instant('SB_VIEW_UNKNOWN_OBJECT'))));
            return;
        }

        let fields = Object.keys(this.view.getViewFields());
        let model_fields = this.view.getModelFields();
        let translation = this.view.getTranslation();
        const user = this.view.getUser();

        // remember which element has focus (DOM is going to be modified)
        // #memo - at this stage the focus might already be lost (see below)
        // this.focused_widget_id = this.$layout.find("input:focus").closest('.sb-widget').attr('id');

        if(objects.length > 0) {
            // #todo - keep internal index of the object to display (with a prev/next navigation in the header)
            let object:any = objects[0];

            // update actions in view header
            let view_schema = this.view.getViewSchema();
            let $view_actions = this.view.getContainer().find('.sb-view-header-actions-view').first().empty();

            // show object status, if defined and present
            if(model_fields.hasOwnProperty('status')) {
                let $status_container = $view_actions.find('#'+this.uuid+'_status');
                if($status_container.length == 0) {
                    let status_title = TranslationService.resolve(translation, 'model', [], 'status', 'status', 'label');
                    $status_container = $('<div style="margin-left: auto;"></div>').attr('id', this.uuid+'_status').append( $('<span style="line-height: 46px; margin-right: 12px; text-transform: capitalize;">'+status_title+': <span class="status-value"></span></span>') ).appendTo($view_actions);
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
                    let visible = this.isVisible(action?.visible || '', object, user, {}, this.getEnv());
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
                // #memo - we already emptyied sb-view-header-actions-view when retrieving $view_actions
                // $view_actions.find('#'+this.uuid+'_actions-button').remove();
                // $view_actions.find('#'+this.uuid+'_actions-dropdown').remove();

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
                    $actions_dropdown.find('.mdc-menu').addClass('mdc-menu-surface--is-open-left').addClass('mdc-menu-surface--is-width-auto');
                    let $menu_list = $actions_dropdown.find('.menu-list');
                    // keep track of empty lists
                    for(let action of actions) {
                        let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                        let item_id = this.uuid+'_action-' + (''+action.id).replace(/\./g,'_');
                        let $item = UIHelper.createListItem(item_id, action_title);
                        $menu_list.append($item);
                        this.decorateActionButton($item, action, object);
                    }
                }
            }

            // update groups visibility, if any
            let $groups = this.$layout.find('.sb-view-form-group');
            $groups.each( (i: number, elem: any) => {
                let $group = $(elem);
                let visible = this.isVisible($group.attr('data-visible') || '', object, user, {}, this.getEnv());
                if(!visible) {
                    $group.hide();
                }
                else {
                    $group.show();
                    // pass-1 - handle visibility of sub-elements
                    $group.find('.sb-view-form-section, .sb-view-form-row, .sb-view-form-column').each((index: number, elem: any) => {
                        const $elem = $(elem);
                        const visible = this.isVisible($elem.attr('data-visible') || '', object, user, {}, this.getEnv());
                        if(visible) {
                            $elem.show();
                        }
                        else {
                            $elem.hide();
                        }
                    });

                    // pass-2 - update tabs visibility, if any
                    let $tabs = $group.find('.sb-view-form-section-tab');
                    // when active tab is hidden, the next visible one must be auto selected (always enabled for single tab)
                    let auto_select: boolean = ($tabs.length == 1);
                    $tabs.each( (i: number, elem: any) => {
                        let $tab = $(elem);
                        const visible = this.isVisible($tab.attr('data-visible') || '', object, user, {}, this.getEnv());
                        if(visible) {
                            $tab.show();
                            if(auto_select || $tab.hasClass('is-active')) {
                                $tab.trigger('click');
                                auto_select = false;
                            }
                        }
                        else {
                            $tab.hide();
                            $group.find('#' + $tab.attr('data-section_id')).hide();
                        }
                    });
                }
                // handle group with a single section
                /*
                // #memo -added below with support for all sub elements
                if(parseInt(<string> $group.attr('data-sections_count')) <= 1) {
                    // update section visibility
                    let $section = $group.find('.sb-view-form-section').first();
                    let visible = this.isVisible($section.attr('data-visible') ||'', object, user, {}, this.getEnv());
                    if(visible) {
                        $section.show();
                    }
                    else {
                        $section.hide();
                    }
                }
                */
            });

            for(let widget_index of Object.keys(this.model_widgets[0])) {
                let widget: Widget = this.model_widgets[0][widget_index];
                // widget might be missing (if not visible)
                if(!widget) {
                    continue;
                }

                let config = widget.getConfig();

                if( config['widget_type'] == 'label') {
                    let visible = true;
                    // handle visibility tests (domain)
                    if(config.hasOwnProperty('visible')) {
                        visible = this.isVisible(config.visible, object, user, {}, this.getEnv());
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
                    let $parent = this.$layout.find('#' + widget.getId()).parent();
                    let type: string | null = this.view.getModel().getFinalType(field);

                    let has_changed = false;
                    let value = (object.hasOwnProperty(field)) ? object[field] : undefined;


                    // for relational fields, we need to check if the Model has been fetched
                    if(type && ['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {
                        // if widget has a domain, parse it using current object and user
                        if(config.hasOwnProperty('original_domain')) {
                            console.debug('LayouForm::feed - parsing domain for widget', field, config);
                            let tmpDomain = new Domain(config.original_domain);
                            config.domain = tmpDomain.parse(object, user, {}, this.getEnv()).toArray();
                        }
                        else {
                            config.domain = [];
                        }

                        // if widget has a custom header definition, parse subsequent domains, if any
                        if(config.hasOwnProperty('header') && config.header.hasOwnProperty('actions') ) {
                            for (const [id, items] of Object.entries(config.header.actions)) {
                                for(let index in (<Array<any>> items)) {
                                    let item = (<Array<any>> items)[<any> index];
                                    if(item.hasOwnProperty('domain')) {
                                        let tmpDomain = new Domain(item.domain);
                                        config.header.actions[id][index].domain = tmpDomain.parse(object, user, {}, this.getEnv()).toArray();
                                    }
                                }
                            }
                        }

                        if(type == 'many2one') {
                            if(object[field]) {
                                // by convention, `name` subfield is always loaded for relational fields
                                value = object[field]['name'];
                                // special case where a valid object is given, but with empty name
                                if(typeof value === 'string' && value.trim() === '') {
                                    value = String(object[field]['id']);
                                }
                                config.object_id = object[field]['id'];
                                // in some cases, we need the reference to the current object (refs in header domain)
                                config.object = object;
                            }
                            // config.object_id might have been modified by selection : remove it if not present or empty
                            else if(config.hasOwnProperty('object_id')) {
                                delete config.object_id;
                                config.object = null;
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
                            // in some cases, we need the reference to the current object (refs in header domain)
                            config.object = object;
                        }
                    }

                    // #todo - systematize the way change is transmitted
                    has_changed = (!value || $parent.data('value') != JSON.stringify(value));
                    if(widget.getConfig().hasOwnProperty('changed') && widget.getConfig().changed) {
                        has_changed = true;
                        widget.setConfig({...config, changed: false});
                    }

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
                        /*
                        // #memo - is this necessary ?
                        $widget.on('click', () => {
                            this.focused_widget_id = widget.getId();
                        } );
                        */
                        // Handle Widget update handler
                        $widget.on('_updatedWidget', async (event:any, refresh: boolean = true) => {
                            console.debug("Layout::feedForm : received _updatedWidget", field, widget.getValue(), refresh);
                            // #memo - the focus must be given back to currently focused item, regardless of the updated widget
                            // this.focused_widget_id = widget.getId();

                            // update object with new value
                            let values: any = {};
                            let model_fields: any = {};

                            values[field] = widget.getValue();

                            // relay the change to back-end through onupdate
                            // if value is over 1k, do not relay onchange to server
                            // #todo - choose a proportionate (objectivable) limit
                            if(widget.getType() === 'file' || widget.toString().length < 1000) {
                                try {
                                    let params: any = {
                                        entity: this.view.getEntity(),
                                        changes: {},
                                        values: {},
                                        lang: this.view.getLang()
                                    };
                                    // for `file` wdgets, we relay only meta instead of full binary data (see below)
                                    if(widget.getType() === 'file') {
                                        params.changes[field] = widget.getMeta();
                                    }
                                    else {
                                        params.changes = this.view.getModel().export(values);
                                        params.values  = this.view.getModel().export(object);
                                    }

                                    const result = await ApiService.call("?do=model_onchange", params);

                                    if(typeof result === 'object' && result != null) {

                                        for(let changed_field of Object.keys(result)) {
                                            // there are changes to apply on the schema: we must force a re-feed on the Form
                                            refresh = true;

                                            let changed_field_type: string | null = this.view.getModel().getFinalType(changed_field);
                                            // if some changes are returned from the back-end, append them to the view model update
                                            if(typeof result[changed_field] === 'object' && result[changed_field] !== null) {

                                                model_fields[changed_field] = result[changed_field];

                                                if(result[changed_field].hasOwnProperty('value')) {
                                                    values[changed_field] = result[changed_field].value;
                                                }
                                                else if(changed_field_type == 'many2one') {
                                                    console.debug('assigning value for ', changed_field);
                                                    // #memo - m2o widgets use an object as value
                                                    values[changed_field] = result[changed_field];
                                                    if(result[changed_field].hasOwnProperty('domain')) {
                                                        // #todo - using original_domain is probabily no longer necessary (see above)
                                                        // force changing original_domain
                                                        model_fields[changed_field].original_domain = result[changed_field].domain;
                                                        this.view.updateModelField(changed_field, 'domain', result[changed_field].domain);
                                                    }
                                                }

                                                if(result[changed_field].hasOwnProperty('selection')) {
                                                    // special case of a descriptor providing a selection
                                                    // #memo - this is because a string with selection is handled in a distinct way (WidgetSelect)
                                                    let normalize_selection = WidgetFactory.getNormalizedSelection(translation, changed_field, result[changed_field].selection);
                                                    // 1) set virtual `values` property (used by WidgetSelect) to assign & refresh the widget accordingly
                                                    model_fields[changed_field].values = normalize_selection;
                                                    // 2) update view model in case selection is added on another widget type (WidgetString, WidgetInteger, ...)
                                                    this.view.updateModelField(changed_field, 'selection', normalize_selection);
                                                }
                                            }
                                            else {
                                                values[changed_field] = result[changed_field];
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
                                console.debug('LayoutForm::feed - updating model', model_fields);
                                // retrieve the widget based on the field name
                                for(let widget_index of Object.keys(this.model_widgets[0])) {
                                    let widget = this.model_widgets[0][widget_index];
                                    let field = widget.config.field;
                                    if(model_fields.hasOwnProperty(field)) {
                                        for(let property of Object.keys(model_fields[field])) {
                                            widget.config[property] = model_fields[field][property];
                                            widget.config.changed = true;
                                        }
                                        console.debug('LayoutForm::feed - updated widget', widget);
                                    }
                                }
                            }
                            if(Object.keys(values).length > 0) {
                                this.view.onchangeViewModel([object.id], values, refresh);
                            }
                        });

                        // prevent refreshing objects that haven't changed
                        if(has_changed) {
                            // append rendered widget
                            $parent.empty().append($widget).show();
                        }
                    }
                }
            }

            // attempt to give the focus back to the previously focused widget
            if(this.focused_widget_id) {
                console.debug('LayoutForm:FOCUS Attempting to give (back) focus to ', this.focused_widget_id);
                let $focusCandidate: any = $('#' + this.focused_widget_id).find('input').first();
                if($focusCandidate.length == 0 || !$focusCandidate.is(":visible")) {
                    $focusCandidate = $('#' + this.focused_widget_id).find('[tabindex]').first();
                }
                if($focusCandidate.length > 0 && $focusCandidate.is(":visible") && !$focusCandidate.is(":disabled")) {
                    console.debug('LayoutForm:: give (back) focus to ', $focusCandidate, this.focused_widget_id);
                    $focusCandidate.trigger('focus');
                }
                else {
                    console.warn("LayoutForm:FOCUS No valid focusable element found in widget", this.focused_widget_id);
                }
            }
            else {
                // by convention give the focus to the first input (widget) of the layout
                setTimeout( () => {
                    // unless focus has already been manually given by user
                    if(this.focused_widget_id) {
                        return;
                    }
                    console.debug('LayoutForm:FOCUS Giving focus to first input');
                    this.$layout.find('input').first().trigger('focus');
                // delay to allow considering user manual selection
                }, 1000);
            }
        }

        // listen to all focus changes to capture the active widget
        this.$layout.on('focusin click', 'input, [tabindex]', (event:any) => {
            const $changed_widget = $(event.target).closest('.sb-widget');
            if($changed_widget.length) {
                this.focused_widget_id = $changed_widget.attr('id') || '';
                console.debug('LayoutForm:FOCUS Observing focus change to ', this.focused_widget_id);
            }
        });

    }

}
