import { $ } from "../jquery-lib";
import { UIHelper } from '../material-lib';
import { Widget, WidgetFactory } from "../equal-widgets";
import { Layout, LayoutInterface } from './Layout';
import { TranslationService, ApiService, EnvService } from "../equal-services";
import { Domain, Clause, Condition, Reference } from "../Domain";
import moment from 'moment/moment.js';

export class LayoutList extends Layout {

    public async init() {
        console.debug('LayoutList::init');
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
        console.debug('LayoutList::refresh');

        // also re-generate the layout
        if(full) {
            this.$layout.empty();
            this.layout();
        }
        else {
            // unselect all
            $('td:first-child', this.$layout.find('tbody')).each( (i:number, elem:any) => { $('input[type="checkbox"]', elem).prop('checked', false) });
            this.$layout.find('thead').find('th:first-child').find('input').trigger('refresh');
        }

        // auto open (unfold) groups, if requested
        let group_by = this.view.getGroupBy();
        if(group_by.length > 0) {
            let $fold_toggle = this.$layout.find('thead tr th.sb-group-cell');
            this.getView().isReady().then( () => {
                if(typeof group_by[0] === 'object' && group_by[0].hasOwnProperty('open') && group_by[0].open) {
                    $fold_toggle.trigger('click');
                }
            });
        }

        // feed layout with current Model
        let objects = await this.view.getModel().get();
        this.feed(objects);
    }

    public loading(loading: boolean) {
        let $elem = this.$layout.find('.table-wrapper');
        let $loader = $elem.find('.table-loader');

        if(loading) {
            $loader.show();
        }
        else {
            $loader.hide();
        }
    }

    protected layout() {
        // create table

        // we define a tree structure according to MDC pattern
        let $elem = $('<div/>').addClass('table-wrapper').css({"width": "100%"})
        let $container = $('<div/>').css({"width": "100%"}).appendTo($elem);

        // add spinner
        $container.append( $('<div class="table-loader"> <div class="table-spinner"><div class="spinner__element"></div></div> <div class="table-overlay"></div> </div>') );

        let $table = $('<table/>').css({"width": "100%"}).appendTo($container);
        let $thead = $('<thead/>').appendTo($table);
        let $tbody = $('<tbody/>').appendTo($table);

        // instantiate header row and the first column which contains the 'select-all' checkbox
        let $hrow = $('<tr/>');

        if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
            UIHelper.createTableCellCheckbox(this.uuid + 'table-cell', true)
            .appendTo($hrow)
            .find('input')
            .on('click', () => setTimeout( () => this.view.onchangeSelection(this.getSelected()) ) );
        }

        let group_by = this.view.getGroupBy();
        if(group_by.length > 0) {
            let $fold_toggle = $('<th />').addClass('sb-group-cell folded').css({'width': '44px', 'cursor': 'pointer'}).append( $('<i/>').addClass('material-icons sb-toggle-button').text('chevron_right') );
            $hrow.append( $fold_toggle );

            $fold_toggle.on('click', () => {
                let $tbody = this.$layout.find('tbody');
                let folded = $fold_toggle.hasClass('folded');
                if(folded) {
                    $fold_toggle.removeClass('folded');
                }
                else {
                    $fold_toggle.addClass('folded');
                }
                folded = !folded;
                $tbody.find('.sb-group-row').each( (index: number, elem: any) => {
                    let $this = $(elem);
                    let subfolded = $this.hasClass('folded');
                    if(subfolded != folded) {
                        $this.trigger('click');
                    }
                });
            });
        }

        // create other columns, based on the col_model given in the configuration
        let view_schema = this.view.getViewSchema();
        let translation = this.view.getTranslation();

        let model_fields = this.view.getModelFields();
        let view_fields  = this.view.getViewFields();

        // pre-processing: check columns width consistency
        let item_width_total = 0;

        // 1) sum total width and items with null width
        for(let item of view_schema.layout.items) {
            if(!item.hasOwnProperty('value')) {
                continue;
            }
            let field = item.value;
            if(!(model_fields[field] ?? false)) {
                continue;
            }
            if(!item.hasOwnProperty('visible') || item.visible) {
                // set minimum width to 10%
                let width = 10;
                if(item.hasOwnProperty('width')) {
                    width = Math.round(parseInt(item.width, 10) * 100) / 100.0;
                    if(width < 10) {
                        width = 10;
                    }
                }
                item.width = width;
                item_width_total += width;
            }
        }
        // 2) normalize columns widths (to be exactly 100%)
        if(item_width_total != 100) {
            let ratio = 100.0 / item_width_total;
            for(let item of view_schema.layout.items) {
                if( (!item.hasOwnProperty('visible') || item.visible) && item.hasOwnProperty('width')) {
                    item.width *= ratio;
                }
            }
        }

        let first_column: boolean = true;

        for(let item of view_schema.layout.items) {
            if(!item.hasOwnProperty('value')) {
                continue;
            }
            let field = item.value;
            if(!(model_fields[field] ?? false)) {
                continue;
            }
            let config = WidgetFactory.getWidgetConfig(this.view, field, translation, model_fields, view_fields);
            if(!config) {
                continue;
            }
            // ignore non-visible columns
            if(config.hasOwnProperty('visible') && config.visible === 'false') {
                continue;
            }
            let width = Math.floor(10 * item.width) / 10;
            let $cell = $('<th/>').attr('name', field)
                // #memo - by using css, columns are adapted according to additional columns with fixed width, if any (checkbox & actions)
                .css({width: width + '%'})
                .append(config.title)
                .on('click', (event:any) => {
                    let $this = $(event.currentTarget);
                    if($this.hasClass('sortable')) {
                        // unselect all lines
                        $('td:first-child', this.$layout.find('tbody')).each( (i:number, elem:any) => {
                            $('input[type="checkbox"]', elem).prop('checked', false).prop('indeterminate', false);
                        });
                        $thead.find('th:first-child').find('input').trigger('refresh');

                        // wait for handling of sort toggle (table decorator)
                        setTimeout( () => {
                            // change sort field and/or sort order
                            this.view.setOrder(<string> $this.attr('name'));
                            this.view.setSort(<string> $this.attr('data-sort'));
                            this.view.onchangeView();
                        });
                    }
                });
            $cell.css({'text-align': config.align});
            if(config.align == 'right' || config.align == 'center') {
                $cell.css({'padding-right': '16px'});
            }
            if(config.sortable) {
                $cell.addClass('sortable').attr('data-sort', '');
            }
            $hrow.append($cell);
            first_column = false;

        }
        // #memo - action columns is not displayed if its width is null (manually set below according to number of actions)
        let $actions_column = $('<th/>').attr('name', 'actions').css({'text-align': 'right'}).appendTo($hrow);

        $thead.append($hrow);

        this.$layout.append($elem);

        if(view_schema.hasOwnProperty('operations')) {
            console.debug(' ');

            let $operations = $('<div>').addClass('table-operations');
            for(let operation in view_schema.operations) {
                let op_descriptor = view_schema.operations[operation];

                let $op_div = $('<div>').addClass('operation');
                let $title = $('<div>').addClass('operation-title').text(operation);
                // $op_div.append($title);
                let $op_row = $('<div>').addClass('operation-row').appendTo($op_div);
                let pos = 0;
                for(let item of view_schema.layout.items) {
                    if(item.hasOwnProperty('visible') && !item.visible) {
                        continue;
                    }
                    let width = Math.floor(10 * item.width) / 10;
                    let $cell = $('<div>').addClass('operation-cell mdc-data-table__cell').css({width: width + '%'});
                    if(pos == 0) {
                        let offset = 0;
                        if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
                            offset += 44;
                        }
                        if(group_by.length > 0) {
                            offset += 44;
                        }
                        if(offset > 0) {
                            $cell.css({width: 'calc(' + width + '% + ' + offset + 'px)' });
                        }
                    }
                    let field = item.value;
                    if(op_descriptor.hasOwnProperty(field)) {
                        $cell.attr('data-id', 'operation-' + operation + '-' + field);
                        let type: string | null = this.view.getModel().getFinalType(field);
                        if(type && ['float', 'integer', 'time'].indexOf(type) >= 0 && field != 'id') {
                            $cell.css({'text-align': 'right'});
                        }
                    }
                    else if(pos == 0) {
                        $cell.append($title);
                    }
                    $op_row.append($cell);
                    ++pos;
                }

                $operations.append($op_div);
            }
            $elem.append($operations);
        }

        UIHelper.decorateTable($elem, view_schema);



        let count_actions_column_items: number = 0;
        console.debug('LayoutList::layout - testing routes & actions');

        if(view_schema.hasOwnProperty('actions') && view_schema.actions.length) {
            console.debug('LayoutList::layout - adding actions');
            // #memo actions from view_schema.actions that are relative to a single object can be marked with the "inline" property, in such case they are rendered as buttons on each line (see below)
            // otherwise actions are considered global to the view and are displayed in the top right corner (similar to forms)
            // for actions depending on current selection, use  {view_schema}.header.actions
            let $view_actions = this.view.getContainer().find('.sb-view-header-actions-view').first().empty();

            for(let action of view_schema.actions) {
                if(action.hasOwnProperty('inline') && action.inline) {
                    ++count_actions_column_items;
                    continue;
                }
                // do not show action buttons for lists as sub-form (widget)
                if(this.view.getPurpose() === 'widget') {
                    continue;
                }
                let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                let $action_button = UIHelper.createButton(this.uuid + '_action-view-' + action.id, action_title, 'outlined');
                $action_button.css({'margin-left': '12px'});
                $view_actions.append($action_button);
                this.decorateActionButton($action_button, action);
            }
        }

        if(view_schema.hasOwnProperty('routes') && view_schema.routes.length) {
            console.debug('LayoutList::layout - adding routes');
            // #memo - only inline routes are supported and handled as actions opening the context given in the route
            for(let route of view_schema.routes) {
                if(route.hasOwnProperty('inline') && route.inline) {
                    ++count_actions_column_items;
                    continue;
                }
            }
        }

        if(count_actions_column_items > 0) {
            const actions_width = (count_actions_column_items * 44) + 10;
            // set action column width according to number of actions
            $actions_column.css({width: actions_width + 'px'});
            // add a virtual column of same width in operation rows (to maintain alignment)
            if(view_schema.hasOwnProperty('operations')) {
                let $op_rows: any = $elem.find('.table-operations').first().find('.operation-row');
            console.debug('LayoutList::layout - fadding width to op_rows', $op_rows);
                for(let $op_row of $op_rows) {
                    $('<div/>')
                        .addClass('operation-cell mdc-data-table__cell sb-operation-actions-cell')
                        .css({ width: actions_width + 'px', 'text-align': 'right' })
                        .appendTo($op_row);
                }
            }
        }

    }

    protected async feed(objects: any) {
        console.debug('LayoutList::feed', objects);

        this.$layout.find("tbody").remove();

        let group_by = this.view.getGroupBy();

        let groups: any = {};

        if(group_by.length > 0) {
            groups = this.feedListGroupObjects(objects, group_by);
        }

        console.debug('LayoutList::feed - groups', groups);

        const user = this.view.getUser();

        let view_schema = this.view.getViewSchema();

        let $elem = this.$layout.find('.table-wrapper');
        let $table = $elem.find('table');

        let $tbody = $('<tbody/>');

        let stack = (group_by.length == 0) ? [objects] : [groups];

        while(true) {
            if(stack.length == 0) {
                break;
            }

            let group = stack.pop();

            if(!group) {
                break;
            }

            // 'group' is an array of objects: render a row for each object
            if( Array.isArray(group) ) {
                let parent_group_id = '';
                let $previous = $tbody.children().last();
                if($previous && $previous.hasClass('sb-group-row')) {
                    parent_group_id = <string> $previous.attr('data-id');
                }
                for(let object of group) {
                    let $row = this.feedListCreateObjectRow(object, parent_group_id);
                    let $actions_cell = $('<td/>').addClass('sb-action-cell').css({'text-overflow': 'unset'});
                    // #inline #action #inline_actions - add actions for single line
                    // #todo - add a disable-overlay on the whole column (to prevent multiple clicks when action is running)

                    if(view_schema.hasOwnProperty('actions')) {
                        for(let action of view_schema.actions) {
                            let visible = true;
                            if(!action.hasOwnProperty('inline') || !action.inline) {
                                visible = false;
                            }
                            else if(action.hasOwnProperty('visible')) {
                                visible = this.isVisible(action.visible, object, user, {}, this.getEnv());
                            }
                            if(!visible) {
                                continue;
                            }
                            let action_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, action.label);
                            let $action_button = UIHelper.createButton(this.uuid + '_action-view-' + action.id + '-' + object.id, action_title, 'icon', action.icon ?? 'done');
                            $action_button.attr('title', action_title);
                            this.decorateActionButton($action_button, action, object);
                            $actions_cell.append($action_button);
                        }
                    }

                    if(view_schema.hasOwnProperty('routes')) {
                        for(let route of view_schema.routes) {
                            let visible = true;
                            if(!route.hasOwnProperty('inline') || !route.inline) {
                                visible = false;
                            }
                            else if(route.hasOwnProperty('visible')) {
                                visible = this.isVisible(route.visible, object, user, {}, this.getEnv());
                            }
                            if(!visible) {
                                continue;
                            }
                            let route_title = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'routes'], route.id, route.label);
                            let $route_button = UIHelper.createButton(this.uuid + '_action-view-' + route.id + '-' + object.id, route_title, 'icon', route.icon ?? 'done');
                            $route_button.attr('title', route_title);
                            this.decorateRouteButton($route_button, route, object);
                            $actions_cell.append($route_button);
                        }
                    }

                    $row.append($actions_cell);
                    $tbody.append($row);
                }
            }
            // 'group' is a header line
            else if(group.hasOwnProperty('_is_group')) {
                let $row = this.feedListCreateGroupRow(group, $tbody);
                $row.append($('<td/>'));
                $tbody.append($row);
            }
            // 'group' is a descriptor and needs to be pushed on the stack
            else {
                // #memo - keys must be strings
                let keys = Object.keys(group).sort().reverse();
                for(let key of keys) {
                    // ignore special keys (used for group properties)
                    if(key.charAt(0) == '_') {
                        continue;
                    }
                    // add object or array
                    if(group[key].hasOwnProperty('_data')) {
                        stack.push(group[key]['_data']);
                    }
                    else {
                        stack.push(group[key]);
                    }
                    stack.push({'_is_group': true, ...group[key]});
                }
            }
        }

        $table.find('tbody').remove();
        $table.append($tbody);

        if(view_schema.hasOwnProperty('operations')) {

            for(let operation in view_schema.operations) {
                let descriptor = view_schema.operations[operation];

                for(let item of view_schema.layout.items) {

                    if(item.hasOwnProperty('visible') && item.visible == false) {
                        continue;
                    }
                    let op_field = item.value;
                    if(!descriptor.hasOwnProperty(op_field)) {
                        continue;
                    }
                    let op_type = descriptor[op_field]['operation'];
                    let op_result: number = 0.0;
                    let usage: string = descriptor[op_field]?.usage ?? null;
                    // #todo - use computeOperation()
                    let i: number = 0;
                    for (let object of objects) {
                        let val: any = object[op_field];
                        if( usage == 'time' || usage == 'time/plain' ) {
                            const time_str = typeof val === 'string' ? val : '';
                            const [hours, minutes, seconds] = time_str.split(':').map(Number);
                            val = (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
                        }
                        switch(op_type) {
                            case 'DIFF':
                                op_result = (i == 0) ? val : (op_result - val);
                                break;
                            case 'SUM':
                                op_result += val;
                                break;
                            case 'COUNT':
                                op_result += 1;
                                break;
                            case 'MIN':
                                if(i == 0 || op_result > val) {
                                    op_result = val;
                                }
                                break;
                            case 'MAX':
                                if(i == 0 || op_result < val) {
                                    op_result = val;
                                }
                                break;
                            case 'AVG':
                                op_result += (val - op_result) / (i+1);
                                break;
                        }
                        ++i;
                    }

                    let prefix = descriptor[item.value]?.prefix ?? '';
                    let suffix = descriptor[item.value]?.suffix ?? '';

                    let type: string | null = this.view.getModel().getFinalType(op_field);
                    let value: string = Widget.toString(type ?? 'string', op_result, usage);

                    this.$layout.find('[data-id="' + 'operation-' + operation + '-' + op_field + '"]').addClass('computed-operation').text(prefix + value + suffix);
                }
            }
        }

        UIHelper.decorateTable($elem, view_schema);

        // handler for reordering through drag n drop
        $elem.on('_updateOrder', (event: any, updates: any[]) => {
            for(let object of updates) {
                // update displayed value of 'order' field (handler will retrieve matching widget)
                this.$layout.find('tr[data-id="' + object.id + '"]').trigger('_setValue', ['order', object.order]);
                // #memo - drag n drop is limited to view mode and in view mode _updatedWidget is never triggered
                ApiService.update(this.view.getEntity(), [object.id], {order: object.order}, true, this.view.getLang());
            }
        });
    }

    private feedListGroupObjects(objects: any[], group_by: string[]) {
        let groups: any = {};
        let model_fields = this.view.getModelFields();

        // group objects
        for (let object of objects) {
            const n = group_by.length;
            let parent = groups;
            // #memo - we prepend parent_id to subgroups ids
            let parent_id = '';
            let level = 0;

            for(let i = 0; i < n; ++i) {
                let field, group: any = group_by[i];

                if(typeof group == 'object') {
                    if(!group.hasOwnProperty('field')) {
                        continue;
                    }
                    field = group.field;
                }
                else {
                    field = group;
                }

                let model_def = model_fields[field] ?? null;

                if(!model_def) {
                    console.warn('invalid field or value while grouping object on field ' + field, group, object);
                    continue;
                }

                let key = object[field];

                let label: any = key;

                if(key === null || key === undefined || key === '') {
                    console.debug('empty key found for grouping on field ' + field, group, object);
                    key = 'no_value';
                    label = 'empty';
                }

                if(typeof key == 'object' && key.hasOwnProperty('name')) {
                    label = key.name;
                    if(group.hasOwnProperty('order') && key.hasOwnProperty(group.order)) {
                        key = String(key[group.order]).padStart(11, '0');
                    }
                    else {
                        key = key.name;
                    }
                }

                if(['date', 'datetime'].indexOf(model_def['type']) >= 0) {
                    label = moment(key).format(moment.localeData().longDateFormat('L'));
                    key = moment(key).format('YYYY-MM-DD');
                }
                else if(model_def.hasOwnProperty('usage') && model_def.usage == 'date/month') {
                    // convert ISO8601 month (1-12) to js month  (0-11)
                    key = parseInt(key) - 1;
                    label = moment().month(key).format('MMMM');
                    key = String(key).padStart(2, '0');
                }
                else if(typeof key === 'string') {
                    // remove special chars (to prevent issue when injecting to [data-id])
                    key = key.replace(/[^a-zA-Z0-9]/g, "_");
                }

                if(!parent.hasOwnProperty(key)) {
                    if(i < n-1) {
                        //  no data (data are stored in children)
                        parent[key] = {'_id': parent_id + key, '_parent_id': parent_id, '_key': key, '_label': label, '_level': level};
                    }
                    else {
                        parent[key] = {'_id': parent_id + key, '_parent_id': parent_id, '_key': key, '_label': label, '_level': level, '_data': []};
                    }
                    if(typeof group == 'object') {
                        if(group.hasOwnProperty('operation')) {
                            parent[key]['_operation'] = group.operation;
                        }
                        if(group.hasOwnProperty('operations')) {
                            parent[key]['_operations'] = group.operations;
                        }
                        if(group.hasOwnProperty('colspan')) {
                            parent[key]['_colspan'] = group.colspan;
                        }
                    }

                }

                parent_id = parent_id + key;
                parent = parent[key];
                ++level;
            }
            if( parent.hasOwnProperty('_data') && Array.isArray(parent['_data']) ) {
                parent['_data'].push(object);
                console.debug('LayoutList::feedListGroupObjects - added object', object.id, 'to group', parent['_id'], 'key', parent['_key']);
            }
        }
        return groups;
    }

    public prependObject(object: any, actions: any[] = []) {
        let $tbody = this.$layout.find("tbody");

        let $row = this.feedListCreateObjectRow(object);

        // Check if an sb-action-cell already exists in $row
        let $actions_cell = $row.find('.sb-action-cell').empty();
        if($actions_cell.length === 0) {
            $actions_cell = $('<td/>').addClass('sb-action-cell').css({'text-overflow': 'unset'});
        }

        for(let action of actions) {
            let $action_button = UIHelper.createButton(this.uuid + '_action-view-' + action.id + '-' + object.id, '', 'icon', action.icon ?? 'done');
            if(action.hasOwnProperty('color')) {
                $action_button.css({'color': action.color});
            }
            this.decorateActionButton($action_button, action, object);
            $actions_cell.append($action_button);
        }

        $row.append($actions_cell);

        // decorate
        $row.find('td').addClass('mdc-data-table__cell');
        $tbody.prepend($row);
    }

    /**
     *
     * @param object
     * @param parent_group_id A string used as DOM id that allows to retrieve parent node.
     * @returns
     */
    private feedListCreateObjectRow(object: any, parent_group_id: string = '') {
        let view_schema = this.view.getViewSchema();

        let view_fields = this.view.getViewFields();
        let model_fields = this.view.getModelFields();
        let translation = this.view.getTranslation();

        const user = this.view.getUser();

        let group_by = this.view.getGroupBy();

        let $row = $('<tr/>')
            .addClass('sb-view-layout-list-row')
            .attr('data-parent-id', parent_group_id)
            .attr('data-id', object.id)
            .attr('data-edit', '0')
            // dispatch value setter
            .on('_setValue', (event: any, field: string, value: any) => {
                console.log('Received _setValue event on row ', object.id, field, value);
                let widget = this.model_widgets[object.id][field];
                widget.change(value);
            })
            // open form view on click
            .on('click', async (event:any) => {
                let $this = $(event.currentTarget);
                if(this.view.getPurpose() == 'add' || this.view.getPurpose() == 'select') {
                    this.addToSelection([object.id]);
                    this.view.triggerAction('ACTION.SELECT');
                    return;
                }
                // discard click when row is being edited
                if($this.attr('data-edit') == '0') {
                    this.view.setActiveObjectId(object.id);

                    let childViewSchema = await ApiService.getView(this.view.getEntity(), 'form' + '.' + this.view.getName());
                    // #todo - allow overloading default action ('ACTIONS.UPDATE')
                    // fallback to view mode if `header.actions.ACTION.EDIT` is set to false
                    let mode = this.view.getMode();
                    if(childViewSchema.hasOwnProperty('header') && childViewSchema.header.hasOwnProperty('actions')) {
                        if(childViewSchema.header.actions.hasOwnProperty('ACTION.EDIT') && childViewSchema.header.actions['ACTION.EDIT'] === false) {
                            mode = 'view';
                        }
                    }

                    let config: any = {
                            entity: this.view.getEntity(),
                            type: 'form',
                            name: this.view.getName(),
                            mode: mode,
                            domain: ['id', '=', object.id]
                        };
                    // if current list is a widget, reload content after child context has been closed
                    if(this.view.getPurpose() == 'widget') {
                        config.callback = (data: any) => {
                            // trigger a refresh of the current view
                            this.view.onchangeView();
                        };
                    }

                    this.openContext(config);
                }
            })
            // toggle mode for all cells in row
            .on( '_toggle_mode', async (event: any, mode: string = 'view') => {
                console.debug('Layout - received toggle_mode', mode, this);
                let $this = $(event.currentTarget);

                $this.find('td.sb-widget-cell').each( (index: number, elem: any) => {
                    let $cell = $(elem);
                    let field: any = $cell.attr('data-field');
                    let widget = this.model_widgets[object.id][field];

                    // switch to given mode
                    if(widget.getMode() == mode) {
                        return;
                    }

                    $cell.empty();

                    let visible = true;
                    let config = widget.getConfig();
                    // handle visibility tests (domain)
                    if(config.hasOwnProperty('visible')) {
                        visible = this.isVisible(config.visible, object, user, {}, this.getEnv());
                    }

                    if(!visible) {
                        return;
                    }

                    let $widget = widget.setMode(mode).render();

                    $cell.append($widget);

                    // handle special situations that allow cell content to overflow
                    if(widget.getType() == 'boolean') {
                        $cell.addClass('allow-overflow');
                    }

                    if(mode == 'edit') {

                        if(this.view.getPurpose() == 'widget') {
                            // selection actions are not shown : add inline action buttons
                            console.log('we should add action buttons on this line');
                        }

                        // setup listener for objet changes
                        $widget.on('_updatedWidget', async (event: any, refresh: boolean = true) => {
                            console.debug('Layout - received _updatedWidget event', widget.getValue());
                            let values: any = {};
                            values[field] = widget.getValue();
                            let model_fields: any = {};
                            // if value is less than 1k, relay onchange to server
                            // #todo - choose a proportionate (objectivable) limit
                            if(String(widget.getValue()).length < 1000) {
                                // relay the change to back-end through onupdate
                                try {
                                    // #todo - add support for dynamic view_schema (ex. filter or update selection of selectable fields, based on value from other fields)
                                    const result = await ApiService.call("?do=model_onchange", {
                                            entity: this.view.getEntity(),
                                            view_id: this.view.getId(),
                                            changes: this.view.getModel().export(values),
                                            values: this.view.getModel().export(object),
                                            lang: this.view.getLang()
                                        });

                                    if(typeof result === 'object' && result != null) {
                                        for(let field of Object.keys(result)) {
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
                            // update values of widgets impacted by onchange
                            if(Object.keys(values).length > 0) {
                                for(let widget_index of Object.keys(this.model_widgets[object.id])) {
                                    let widget = this.model_widgets[object.id][widget_index];
                                    let field = widget.config.field;
                                    if(values.hasOwnProperty(field)) {
                                        widget.change(values[field]);
                                    }
                                }
                            }
                            // update model schema of the view if necessary
                            if(Object.keys(model_fields).length > 0) {
                                // we need to retrieve the widget based on the field name
                                for(let widget_index of Object.keys(this.model_widgets[object.id])) {
                                    let widget = this.model_widgets[object.id][widget_index];
                                    let field = widget.config.field;
                                    if(model_fields.hasOwnProperty(field)) {
                                        for(let property of Object.keys(model_fields[field])) {
                                            widget.config[property] = model_fields[field][property];
                                            widget.config.changed = true;
                                        }
                                    }
                                }
                            }

                            // propagate model change, without requesting a layout refresh (we're in inline edit and we don't want to refresh the whole view)
                            this.view.onchangeViewModel([object.id], values, false);
                        });
                    }
                });
            });

        if(object.hasOwnProperty('order')) {
            $row.attr('data-order', object.order);
        }

        // for lists in edit mode (excepted widgets), add a checkbox
        // #todo - in some cases we should be able to perform a custom action on elements from widget lists : use embedded actions (?)
        if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
            UIHelper.createTableCellCheckbox(this.uuid + '_object' + object.id)
                .addClass('sb-view-layout-list-row-checkbox')
                .appendTo($row)
                .find('input')
                .attr('data-id', object.id)
                .on('click', (event:any) => {
                    // wait for widget to update and notify about change
                    setTimeout( () => this.view.onchangeSelection(this.getSelected()) );
                    // prevent handling of click on parent `tr` element
                    event.stopPropagation();
                });
        }

        if(group_by.length > 0) {
            // add a cell for the toggle chevron column
            $row.append( $('<td/>') );
        }

        // for each field, create a widget, append to a cell, and append cell to row
        let is_first:boolean = true;
        for(let item of view_schema.layout.items) {

            let config = WidgetFactory.getWidgetConfig(this.view, item.value, translation, model_fields, view_fields);

            if(!config) {
                continue;
            }

            // ignore non-visible fields
            if(config.hasOwnProperty('visible') && config.visible == 'false') {
                continue;
            }

            let value = object[item.value];

            // for relational fields, we need to check if the Model has been fetched
            if(['one2many', 'many2one', 'many2many'].indexOf(config.type) > -1) {

                // if widget has a domain, parse it using current object and user
                if(config.hasOwnProperty('original_domain')) {
                    let tmpDomain = new Domain(config.original_domain);
                    config.domain = tmpDomain.parse(object, user, {}, this.getEnv()).toArray();
                }
                else {
                    config.domain = [];
                }

                // by convention, `name` subfield is always loaded for relational fields
                if(config.type == 'many2one') {
                    value = (object[item.value] && object[item.value].hasOwnProperty('name')) ? object[item.value]['name'] : '';
                    config.object_id = (object[item.value] && object[item.value].hasOwnProperty('id')) ? object[item.value]['id'] : 0;
                }
                else {
                    // Model do not load o2m and m2m fields : these are handled by sub-views
                    // value = object[item.value].map( (o:any) => o.name).join(', ');
                    // value = (value.length > 35)? value.substring(0, 35) + "..." : value;
                    value = "...";
                    // we need the current object id for new objects creation
                    config.object_id = object.id;
                }
            }

            let widget: Widget = WidgetFactory.getWidget(this, config.type, '', '', config);
            widget.setValue(value);
            widget.setReadonly(config.readonly);
            widget.setIsFirst(is_first);
            is_first = false;

            // store widget in widgets Map, using widget id as key (there are several rows for each field)
            if(typeof this.model_widgets[object.id] == 'undefined') {
                this.model_widgets[object.id] = {};
            }
            // store widget: use id and field as keys for storing widgets (current layout is for a single entity)
            this.model_widgets[object.id][item.value] = widget;

            let visible = true;
            // handle visibility tests (domain)
            if(config.hasOwnProperty('visible')) {
                visible = this.isVisible(config.visible, object, user, {}, this.getEnv());
            }

            // #memo - class is added by decorateTable() call in feed() method
            let $cell = $('<td/>').addClass('sb-widget-cell')
                .attr('data-type', config.type)
                .attr('data-field', item.value);

            if(visible) {
                $cell.append(widget.render());
            }

            if (['right', 'center'].includes(config.align)) {
                $cell.css({'text-align': config.align});
            }

            $row.append($cell);
        }
        if(parent_group_id && parent_group_id.length) {
            $row.hide();
        }
        return $row;
    }

    private feedListCreateGroupRow(group:any, $tbody:any) {
        let schema = this.view.getViewSchema();
        let model_fields = this.view.getModelFields();
        let viewModel = this.view.getModel();

        let label: string = (group.hasOwnProperty('_label')) ? group['_label'] : '';
        let level: string = (group.hasOwnProperty('_level')) ? group['_level'] : '';
        let prefix: string = '';
        let suffix: string = '';

        let children_count = 0;
        let parent_group_id = group['_parent_id'];

        if(parent_group_id && parent_group_id.length > 0) {
            let $prev_td = $tbody.find("[data-id='" + parent_group_id + "']").find('.sb-group-cell-label').first();
            if($prev_td) {
                prefix = <string> $prev_td.attr('title') + ' › ';
            }
        }

        if(group.hasOwnProperty('_data')) {
            children_count = group['_data'].length;
        }

        if(group.hasOwnProperty('_operation')) {
            let value = this.computeOperation(group._operation, group);
            suffix = '[' + value + ']';
        }

        const row_uuid: string = UIHelper.getUuid();
        let $row = $('<tr/>')
            .addClass('sb-view-layout-list-row sb-group-row folded')
            .attr('data-parent-id', parent_group_id)
            .attr('data-id', group['_id'])
            .attr('data-key', group['_key'])
            .attr('data-label', group['_label'])
            .attr('data-level', group['_level'])
            .attr('data-children-count', children_count)
            .attr('id', row_uuid);

        if(this.view.getPurpose() != 'widget' || this.view.getMode() == 'edit') {
            let $checkbox = UIHelper.createTableCellCheckbox(row_uuid).addClass('sb-view-layout-list-row-checkbox');
            $checkbox.find('input').on('click', (event:any) => {
                event.stopPropagation();

                let $tbody = this.$layout.find('tbody');
                let checked = $checkbox.find('input').prop('checked');

                let selection:any[] = [];

                $tbody.find("[data-parent-id='" + group['_id'] + "']").each( (index:number, elem:any) => {
                    let $this = $(elem);
                    if($this.hasClass('sb-group-row')) {
                        let subchecked = $this.children().first().find('input').prop('checked');
                        if(checked != subchecked) {
                            $this.children().first().find('input').trigger('click');
                        }
                    }
                    else {
                        selection.push(parseInt(<string> $this.children().first().find('input').attr('data-id'), 10));
                    }
                });

                if(checked) {
                    this.addToSelection(selection);
                }
                else {
                    this.removeFromSelection(selection);
                }
            });
            $row.append($checkbox);
        }

        // compute colspan: default to full row
        let visible_columns = schema.layout.items.filter( (item: any) => item.visible !== false);

        let colspan = group['_colspan'] ?? visible_columns.length;

        $row.append( $('<td />')
                .addClass('sb-group-cell')
                .css({'padding-left': '' + (12 + parseInt(level) * 4) + 'px)'})
                .append( $('<i/>').addClass('material-icons sb-toggle-button').text('chevron_right') )
            );

        $row.append( $('<td/>')
                .attr('title', prefix + label)
                .attr('colspan', colspan)
                .addClass('sb-group-cell sb-group-cell-label')
                .append('<div style="display: flex;"> <div style="overflow: hidden;text-overflow: ellipsis;">' + prefix + ' <span>' + label + '</span></div>'+'<div style="font-weight: 500; margin-left: 20px;">' + suffix + '</div></div>')
            );

        // append remaining cells, and inject operations, if any
        for(let i = 0, j = 0, n = schema.layout.items.length; i < n; ++i) {
            if(schema.layout.items[i].visible === false) {
                continue;
            }
            if(j < colspan) {
                ++j;
                continue;
            }
            let column = schema.layout.items[i].value;
            let type = viewModel.getFinalType(column);
            let value = '';
            let align = 'right';
            if(group.hasOwnProperty('_operations') && group._operations.hasOwnProperty(column)) {
                let operation = [ group._operations[column]?.operation, column ];
                value = this.computeOperation(operation, group, group._operations[column]?.usage ?? null);
                align = group._operations[column]?.align ?? align;
            }
            $row.append( $('<td/>')
                    .addClass('sb-group-cell sb-group-cell-label sb-widget-cell')
                    .attr('data-type', type)
                    .append('<div class="sb-widget-mode-view" style="width: 100%; text-align: ' + align + '; font-weight: bold;">' + value + '</div>')
                );
        }

        $row.on('click', () => {
            let $tbody = this.$layout.find('tbody');
            let group_id = $row.attr('data-id');
            if($row.hasClass('folded')){
                $row.removeClass('folded');
                $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                    let $this = $(elem);
                    if($this.hasClass('sb-group-row')) {
                        $this.trigger('show');
                    }
                    else {
                        $this.show();
                    }
                });
            }
            else {
                $row.addClass('folded');
                $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                    let $this = $(elem);
                    if($this.hasClass('sb-group-row')) {
                        $this.trigger('hide');
                    }
                    else {
                        $this.hide();
                    }
                });
            }
        });

        $row.on('show', () => {
            let $tbody = this.$layout.find('tbody');

            let group_id = $row.attr('data-id');
            $row.show();
            $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                let $this = $(elem);
                if($this.hasClass('sb-group-row')) {
                    // $this.trigger('show');
                }
                else if(!$row.hasClass('folded')) {
                    $this.show();
                }
            });
        });

        $row.on('hide', () => {
            let $tbody = this.$layout.find('tbody');
            let group_id = $row.attr('data-id');
            $row.hide();
            $tbody.find("[data-parent-id='" + group_id + "']").each( (index:number, elem:any) => {
                let $this = $(elem);
                if($this.hasClass('sb-group-row')) {
                    $this.trigger('hide');
                }
                else {
                    $this.hide();
                }
            });
        });

        if(parent_group_id && parent_group_id.length) {
            $row.hide();
        }

        return $row;
    }

    private computeOperation(operation: Array<string>, group: any, usage?: string | null) {
        let result: string = '';
        let op_type  = operation?.[0] ?? null;
        let op_field = operation?.[1] ?? null;

        let viewSchema = this.view.getViewSchema();
        // support (unnecessary) notation 'object.{field}'
        if(op_field.startsWith('object.')) {
            op_field = (op_field.split('.'))[1];
        }
        const item = viewSchema.layout?.items.find( (item: any) => item.value === op_field );

        if(item) {
            let data: any[] = this.getGroupData(group, op_field);
            let op_result: number = 0;
            let i: number = 0;
            for(let val of data) {
                if(item.type == 'time' || item.result_type == 'time') {
                    const time_str = (typeof val === 'string') ? val : '';
                    const [hours, minutes, seconds] = time_str.split(':').map(Number);
                    val = (hours || 0) * 3600 + (minutes || 0) * 60 + (seconds || 0);
                }
                switch(op_type) {
                    case 'DIFF':
                        op_result = (i == 0) ? val : (op_result - val);
                        break;
                    case 'SUM':
                        op_result += val;
                        break;
                    case 'COUNT':
                        ++op_result;
                        break;
                    case 'MIN':
                        if(i == 0 || val < op_result) {
                            op_result = val;
                        }
                        break;
                    case 'MAX':
                        if(i == 0 || val > op_result) {
                            op_result = val;
                        }
                        break;
                    case 'AVG':
                        op_result += (val - op_result) / (i+1);
                        break;
                }
                ++i;
            }

            let model_def = this.view.getModelFields()[op_field] ?? null;
            let type: string | null = this.view.getModel().getFinalType(op_field);
            usage = usage ?? item.usage ?? model_def.usage ?? null;
            if(usage) {
                type = WidgetFactory.getTypeFromUsage(usage, type ?? 'string');
            }
            result = Widget.toString(type ?? 'string', op_result, usage);
        }
        return result;
    }

    private getGroupData(group: any, field: string) {
        let data: any[] = [];
        if(group.hasOwnProperty('_data')) {
            for(let obj of group['_data']) {
                if(obj.hasOwnProperty(field)) {
                    data.push(obj[field]);
                }
            }
        }
        else {
            let keys = Object.keys(group);
            for(let key of keys) {
                // ignore special keys (used for group properties)
                if(key.charAt(0) == '_') {
                    continue;
                }
                // add object or array
                data = [...data, ...this.getGroupData(group[key], field)];
            }
        }
        return data;
    }
}