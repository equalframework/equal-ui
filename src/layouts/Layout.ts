import { $ } from "../jquery-lib";
import { Widget, WidgetFactory } from "../equal-widgets";
import { UIHelper } from '../material-lib';
import { TranslationService, ApiService, EnvService } from "../equal-services";

import { LayoutList } from "./LayoutList";

import { Domain, Clause, Condition, Reference } from "../Domain";
import View from "../View";

import { saveAs } from 'file-saver';

/*
    There are two main branches of Layouts depending on what is to be displayed:
        - 1 single object : Form
        - several objects : List (grid, cards, graph)

    Forms can be displayed in two modes : 'view' or 'edit'
    Lists can be editable on a Cell basis (using Widgets)
*/

export interface LayoutInterface {
    init(): any;
    refresh(full: boolean): any;
    loading(loading: boolean): any;
    // #todo - add other public methods
}

export class Layout implements LayoutInterface{

    protected uuid: string;
    protected view: View;             // parent view the layout belongs to

    protected $layout: any;

    protected model_widgets: any;


    /**
     *
     * @param view  View    Parent View object
     */
    constructor(view:View) {
        this.uuid = UIHelper.getUuid();
        this.view = view;
        this.$layout = $('<div />').addClass('sb-layout');
        this.model_widgets = {};
        this.view.$layoutContainer.append(this.$layout);
    }

    /*
        Methods from interface, meant to be overloaded in inherited classes
    */
    public init() {}

    public async refresh(full: boolean = false) {}

    public loading(loading:boolean) {}

    /*
        Common methods meant to be overloaded in inherited classes
    */
    protected layout() {}

    protected async feed(objects: any) {}

    public getUuid() {
        return this.uuid;
    }

    public getView() {
        return this.view;
    }

    public getEnv() {
        return this.view.getEnv();
    }

    public getContainer() {
        return this.$layout;
    }

    public destroy() {
        if(!this.model_widgets) {
            return;
        }
        for(let object_id in this.model_widgets) {
            const widgets = this.model_widgets[object_id];
            if(!widgets) {
                continue;
            }
            for(let field in widgets) {
                const widget = widgets[field];
                if(widget && typeof widget.destroy === 'function') {
                    widget.destroy();
                }
            }
        }
    }

    public prependObject(object: any, actions: any[] = []) {
    }

    /**
     * Relay Context opening requests to parent View.
     *
     * @param config
     */
    public async openContext(config: any) {
        console.debug("Layout::openContext", config);
        await this.view.openContext(config);
    }

    /**
     * Browse Layout for checking if required fields have a value set.
     * This method applies only to edit mode and stops after the first found missing value.
     *
     * @returns boolean
     */
    public checkRequiredFields(): boolean {
        if(this.view.getMode() == 'edit') {
            let msg = TranslationService.instant('SB_ERROR_MISSING_MANDATORY');
            for(let object_id in this.model_widgets) {
                let widgets = this.model_widgets[object_id];
                for(let field in widgets) {
                    let widget = widgets[field];
                    let config = widget.getConfig();
                    if(config.hasOwnProperty('required') && config.required) {
                        let value = widget.getValue();
                        if(config.type == 'many2one' && config.hasOwnProperty('object_id')) {
                            value = config.object_id;
                        }
                        if(value === null || value.length == 0) {
                            this.markFieldAsInvalid(parseInt(object_id), field, msg);
                            return false;
                        }
                    }
                }
            }
        }
        return true;
    }

    /**
     *
     * @param field
     * @param message
     */
    public markFieldAsInvalid(object_id: number, field: string, message: string) {
        console.debug('Layout::markFieldAsInvalid', object_id, field);
        if(this.view.getType() == 'form') {
            // by convention, form widgets are stored in first index
            object_id = 0;
        }
        if( this.model_widgets.hasOwnProperty(object_id) && this.model_widgets[object_id].hasOwnProperty(field) ) {
            let widget = this.model_widgets[object_id][field];
            let $elem = this.$layout.find('#'+widget.getId())
            $elem.addClass('mdc-text-field--invalid');
            $elem.find('.mdc-text-field-helper-text').addClass('mdc-text-field-helper-text--persistent mdc-text-field-helper-text--validation-msg').text(message).attr('title', message);
        }
    }

    public updateFieldValue(object_id: number, field: string, value: any) {
        let model_fields = this.view.getModelFields();

        if(!model_fields || !model_fields.hasOwnProperty(field)) {
            return null;
        }

        let type: string | null = this.view.getModel().getFinalType(field);

        if(type && ['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {
            // by convention, `name` subfield is always loaded for relational fields
            if(type == 'many2one') {
                value = value['name'];
            }
            else {
                // #todo : this method should use the same logic as the feed* methods.
            }
        }

        if(this.model_widgets[object_id][field]) {
            this.model_widgets[object_id][field].setValue(value);
        }
    }

    public getSelected() {
        var selection = <any>[];
        let $tbody = this.$layout.find("tbody");
        $tbody.find("input:checked").each( (i:number, elem:any) => {
            let id = $(elem).attr('data-id');
            if(id != undefined) {
                selection.push( parseInt(<string>id, 10) );
            }
        });
        return selection;
    }

    public setSelection(selection: Array<any>) {
        console.debug('Layout::setSelection', selection);
        let $tbody = this.$layout.find("tbody");

        $tbody.find('input[type="checkbox"]').each( (i:number, elem:any) => {
            let data:any = $(elem).attr('data-id');
            if(data != undefined) {
                let id = parseInt(<string> data, 10);
                let $elem = $(elem);
                if(selection.indexOf(id) >= 0) {
                    $elem.prop('checked', true);
                    $elem.trigger('change');
                }
                else {
                    $elem.prop('checked', false);
                    $elem.trigger('change');
                }
            }
        });
    }

    public addToSelection(selection: Array<any>) {
        console.debug('Layout::addToSelection', selection);
        let $tbody = this.$layout.find("tbody");

        $tbody.find('input[type="checkbox"]').each( (i:number, elem:any) => {
            let data:any = $(elem).attr('data-id');
            if(data != undefined) {
                let id = parseInt(<string> data, 10);
                let $elem = $(elem);
                if(selection.indexOf(id) >= 0) {
                    $elem.prop('checked', true);
                    $elem.trigger('change');
                }
            }
        });
        this.$layout.find('thead').find('th:first-child').find('input').trigger('refresh');
        setTimeout( () => this.view.onchangeSelection(this.getSelected()) );
    }

    public removeFromSelection(selection: Array<any>) {
        console.debug('Layout::removeFromSelection', selection);
        let $tbody = this.$layout.find("tbody");

        $tbody.find('input[type="checkbox"]').each( (i:number, elem:any) => {
            let data:any = $(elem).attr('data-id');
            if(data != undefined) {
                let id = parseInt(<string> data, 10);
                let $elem = $(elem);
                if(selection.indexOf(id) >= 0) {
                    $elem.prop('checked', false);
                    $elem.trigger('change');
                }
            }
        });
        this.$layout.find('thead').find('th:first-child').find('input').trigger('refresh');
        setTimeout( () => this.view.onchangeSelection(this.getSelected()) );
    }

    public getSelectedSections() {
        let selectedSections:any = {};
        this.$layout.find('.sb-view-form-group').each( (i:number, group: any) => {
            $(group).find('.sb-view-form-sections-tabbar').find('.sb-view-form-section-tab').each( (j:number, tab) => {
                if($(tab).hasClass('mdc-tab--active')) {
                    selectedSections[i] = j;
                }
            });
        });
        return selectedSections;
    }

    protected async decorateActionButton($button: JQuery, action: any, object: any = {}) {
        $button.on('click', async (event: any) => {
            event.stopPropagation();
            let $disable_overlay = this.view.getContainer().find('.sb-view-header-actions .disable-overlay');

            if(action.hasOwnProperty('callback')) {
                if( ({}).toString.call(action.callback) === '[object Function]' ) {
                    action.callback(object);
                }
                return;
            }

            try {
                let resulting_params: any = {};
                let missing_params: any = {};
                let user = this.view.getUser();
                let parent: any = {};

                // 1) pre-feed with params from the action, if any

                if(!action.hasOwnProperty('params')) {
                    action['params'] = {};
                }

                // inject params of current view as (sub) params
                action.params['params'] = this.getView().getParams();

                // by convention, add current object id as reference
                if(object.hasOwnProperty('id') && !action.params.hasOwnProperty('id')) {
                    action.params['id'] = 'object.id';
                }
                // if there is no `id`, add the domain of the current view, if any
                else {
                    action.params['domain'] = JSON.stringify(this.view.getDomain());
                }

                // if view is a widget, add parent object reference
                if(this.view.getContext().getView() != this.view) {
                    let parentView:View = this.view.getContext().getView();
                    let parent_objects = await parentView.getModel().get();
                    parent = parent_objects[0];
                }

                for(let param of Object.keys(action.params)) {
                    let ref = new Reference(action.params[param]);
                    resulting_params[param] = ref.parse(object, user);
                }

                // 2) retrieve announcement from the target action controller
                const result = await ApiService.fetch("/", {do: action.controller, announce: true, ...resulting_params});
                let params: any = {};
                let response_descr:any = {};
                let description:string = '';

                if(result.hasOwnProperty('announcement')) {
                    if(result.announcement.hasOwnProperty('params')) {
                        params = result.announcement.params;
                    }
                    for(let param of Object.keys(params)) {
                        if(Object.keys(resulting_params).indexOf(param) < 0) {
                            if(params[param].hasOwnProperty('required') && params[param].required) {
                                missing_params[param] = params[param];
                            }
                            else if(action.hasOwnProperty('confirm') && action.confirm) {
                                missing_params[param] = params[param];
                            }
                        }
                    }
                    if(result.announcement.hasOwnProperty('response')) {
                        response_descr = result.announcement.response;
                    }
                    if(result.announcement.hasOwnProperty('description')) {
                        description = result.announcement.description;
                    }
                }

                // 3) retrieve translation related to action, if any
                let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'));

                // check presence of description and fallback to controller description
                if(action.hasOwnProperty('description')) {
                    description = action.description;
                }

                let translated_description = TranslationService.resolve(translation, '', [], '', description, 'description');
                // no translation was found for controller
                if(translated_description == description) {
                    // fallback to current view translation
                    description = TranslationService.resolve(this.view.getTranslation(), 'view', [this.view.getId(), 'actions'], action.id, description, 'description');
                }
                else {
                    description = translated_description;
                }

                let defer = $.Deferred();
                let $description = $('<p />').html(description.replace(/\n/g, "<br />"));

                if(action.hasOwnProperty('confirm') && action.confirm) {
                    // params dialog
                    if(Object.keys(missing_params).length) {
                        let $dialog = UIHelper.createDialog(this.view.getUuid()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.find('.mdc-dialog__content').append($description);
                        await this.view.decorateActionDialog($dialog, action, missing_params, object, user, parent);
                        $dialog.addClass('sb-view-dialog').appendTo(this.view.getContainer());
                        $dialog
                            .on('_accept', () => defer.resolve($dialog.data('result')))
                            .on('_reject', () => defer.reject() );
                        $dialog.trigger('Dialog:_open');
                    }
                    // confirm dialog
                    else {
                        // display confirmation dialog with checkbox for archive
                        let $dialog = UIHelper.createDialog(this.view.getUuid()+'_'+action.id+'_confirm-action-dialog', TranslationService.instant('SB_ACTIONS_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.find('.mdc-dialog__content').append($description);
                        $dialog.appendTo(this.view.getContainer());
                        $dialog
                            .on('_accept', () => defer.resolve())
                            .on('_reject', () => defer.reject() );
                        $dialog.trigger('Dialog:_open');
                    }
                }
                else {
                    // params dialog
                    if(Object.keys(missing_params).length) {
                        let $dialog = UIHelper.createDialog(this.view.getUuid()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                        $dialog.find('.mdc-dialog__content').append($description);
                        await this.view.decorateActionDialog($dialog, action, missing_params, object, user, parent);
                        $dialog.addClass('sb-view-dialog').appendTo(this.view.getContainer());
                        $dialog
                            .on('_accept', () => defer.resolve($dialog.data('result')))
                            .on('_reject', () => defer.reject() );
                        $dialog.trigger('Dialog:_open');
                    }
                    // perform action
                    else {
                        defer.resolve();
                    }
                }

                defer.promise().then( async (result:any) => {
                    // mark action button as loading
                    let $action_button = $button;
                    if($button.prop('nodeName') != 'BUTTON') {
                        $action_button = $button.closest('.mdc-menu-surface--anchor').find('.mdc-button');
                    }
                    $disable_overlay.show();
                    $action_button.addClass('mdc-button--spinner');
                    try {
                        await this.view.performAction(action, {...resulting_params, ...result}, response_descr);
                    }
                    catch(response) {
                        console.debug('unexpected error while performing action', response);
                    }
                    // restore action button
                    $action_button.removeClass('mdc-button--spinner');
                    setTimeout( () => $disable_overlay.hide(), 1000);
                })
                .catch( () => {
                    $button.closest('button').removeClass('mdc-button--spinner');
                    setTimeout( () => $disable_overlay.hide(), 1000);
                });
            }
            catch(response) {
                console.warn('unknown error', response);
                // make sure to restore action button
                setTimeout( () => {
                        $disable_overlay.hide();
                        $button.closest('button').removeClass('mdc-button--spinner');
                    }, 100);
                await this.view.displayErrorFeedback(this.view.getTranslation(), response);
            }
        });
    }

    /**
     * @deprecated
     */
    protected async decorateViewActionDialog($dialog: JQuery, action: any, params: any) {
        let $elem = $('<div />');

        let widgets:any = {};

        // load translation related to controller
        let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'));

        for(let field of Object.keys(params)) {

            let def = params[field];

            let model_fields:any = {};
            model_fields[field] = def;

            let view_fields:any = {};
            view_fields[field] =  {
                "type": "field",
                "value": field
            };

            let config = WidgetFactory.getWidgetConfig(this.view, field, translation, model_fields, view_fields);

            let widget:Widget = WidgetFactory.getWidget(this, config.type, config.title, '', config);
            widget.setMode('edit');
            widget.setReadonly(config.readonly);

            if(def.hasOwnProperty('default')) {
                widget.setValue(def.default);
            }

            let $node = widget.render();
            $node.css({'margin-bottom': '24px'});
            $elem.append($node);
            widgets[field] = widget;
        }

        $dialog.find('.mdc-dialog__content').append($elem);

        $dialog.on('_accept', () => {
            let result:any = {};
            // send payload to target controller

            // read result :
            // if no error refresh view
            // otherwise display error
            for(let field of Object.keys(widgets)) {
                let widget = widgets[field];
                result[field] = widget.getValue();
            }
            $dialog.data('result', result);
        });

    }

    /**
     * @deprecated
     */
    protected async performViewAction(action:any, params:any, translation: any, response_descr: any = {}) {
        try {
            let content_type:string = 'application/json';

            if(response_descr.hasOwnProperty('content-type')) {
                content_type = response_descr['content-type'];
            }

            const result = await ApiService.fetch("/", {do: action.controller, ...params}, content_type);
            const status = ApiService.getLastStatus();
            const headers = ApiService.getLastHeaders();
            // handle binary data response
            if(content_type != 'application/json') {
                let blob = new Blob([result], {type: content_type});
                let filename = "file.download";
                if(headers.hasOwnProperty('content-disposition')) {
                    const parts = headers['content-disposition'].split('=');
                    if(parts.length > 1) {
                        filename = parts[1].slice(1, -1);
                    }
                }
                saveAs(blob, filename);
            }

            // handle HTTP 202 (accepted - no change)
            if(status == 202) {
                // nothing to perform
                // #todo - show snack
                // let $snack = UIHelper.createSnackbar(TranslationService.instant('SB_ACTIONS_NOTIFY_ACTION_SENT', 'Action request sent.'), '', '', 4000);
                // this.$container.append($snack);
            }
            // handle HTTP 205 (reset content)
            else if(status == 205) {
                // mark context as changed to refresh parent lists or views showing deleted object
                this.view.setChanged();
                // close context
                await this.view.closeContext();
            }
            // handle other HTTP status (200 - success, 201 - created, 204 - no content)
            else {
                // refresh current view
                // #memo - this will trigger updatedContext
                await this.view.onchangeView();
            }
        }
        catch(response) {
            // #todo : upon 403, redirect to /auth
            // if a 403 response is received, we assume that the user is not identified: redirect to /auth
            // if(response.status == 403) {
            //     window.location.href = '/auth';
            // }
            await this.view.updatedContext();
            await this.view.displayErrorFeedback(translation, response);
        }
    }

    protected isVisible(visible: string | [], object: any, user: any, parent: any = {}, env: any = {}) {
        console.debug('LayoutForm::isVisible - evaluating visibility', JSON.stringify(visible), object, user, env);
        let result = true;
        if(visible.length) {
            if(visible === 'false') {
                result = false;
            }
            else if(visible === 'true') {
                result = true;
            }
            else {
                try {
                    let array_domain = visible;
                    if(typeof array_domain == 'string') {
                        array_domain = JSON.parse(array_domain);
                    }
                    if(!Array.isArray(array_domain)) {
                        throw new Error('non array visibility domain');
                    }
                    let domain = new Domain(array_domain);
                    result = domain.evaluate(object, user, parent, env);
                }
                catch(error) {
                    console.warn('Error parsing JSON', visible, error);
                }
            }
        }
        console.debug('LayoutForm::isVisible - visibility result', result);
        return result;
    }

}

export default Layout;