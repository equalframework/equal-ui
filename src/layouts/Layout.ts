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
        - several objects : List (grid, kanban, graph)

    Forms can be displayed in two modes : 'view' or 'edit'
    Lists can be editable on a Cell basis (using Widgets)
*/

export interface LayoutInterface {
    init(): any;
    refresh(full: boolean): any;
    // #todo - add other public methods
}

export class Layout implements LayoutInterface{

    protected view: View;             // parent view the layout belongs to

    protected $layout: any;

    protected model_widgets: any;


    /**
     *
     * @param view  View    Parent View object
     */
    constructor(view:View) {
        this.view = view;
        this.$layout = $('<div />').addClass('sb-layout');
        this.model_widgets = {};
        this.view.$layoutContainer.append(this.$layout);
    }

    /*
        Methods from interface, made to be overloaded in inherited classes
    */
    public init() {}
    public refresh(full: boolean = false) {}

    /*
        Common methods made to be overloaded in inherited classes
    */
    protected layout() {}
    protected feed(objects: any) {}


    public loading(loading:boolean) {
        let $elem = this.$layout.find('.table-wrapper');
        let $loader = $elem.find('.table-loader');

        if(loading) {
            $loader.show();
        }
        else {
            $loader.hide();
        }
    }

    public getView() {
        return this.view;
    }

    public getEnv() {
        return this.view.getEnv();
    }

    /**
     * Relay Context opening requests to parent View.
     *
     * @param config
     */
    public openContext(config: any) {
        console.log("Layout::openContext", config);
        this.view.openContext(config);
    }

    /**
     *
     * @param field
     * @param message
     */
    public markFieldAsInvalid(object_id: number, field: string, message: string) {
        console.log('Layout::markFieldAsInvalid', object_id, field);
        if(this.view.getType() == 'form') {
            // by convention, form widgets are strored in first index
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

        let type = this.view.getModel().getFinalType(field);

        if(['one2many', 'many2one', 'many2many'].indexOf(type) > -1) {
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
        console.log('Layout::setSelection', selection);
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
        console.log('Layout::addToSelection', selection);
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
        console.log('Layout::removeFromSelection', selection);
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
        $button.on('click', async () => {
            console.log("click action button ", object);

            // mark action button as loading
            $button.addClass('mdc-button--spinner').attr('disabled', 'disabled');

            let resulting_params:any = {};
            let missing_params:any = {};
            let user = this.view.getUser();

            // 1) pre-feed with params from the action, if any

            if(!action.hasOwnProperty('params')) {
                action['params'] = {};
            }
            // by convention, add current object id as reference
            if(object.hasOwnProperty('id') && !action.params.hasOwnProperty('id')) {
                action.params['id'] = 'object.id';
            }

            for(let param of Object.keys(action.params)) {
                let ref = new Reference(action.params[param]);
                resulting_params[param] = ref.parse(object, user);
            }

            // 2) retrieve announcement from the target action controller
            const result = await ApiService.fetch("/", {do: action.controller, announce: true});
            let params: any = {};
            let response_descr:any = {};
            let description:string = '';

            if(result.hasOwnProperty('announcement')) {
                if(result.announcement.hasOwnProperty('params')) {
                    params = result.announcement.params;
                }
                for(let param of Object.keys(params)) {
                    if(Object.keys(resulting_params).indexOf(param) < 0) {
                        missing_params[param] = params[param];
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
            let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'), this.view.getLocale());

            // restore action button
            $button.removeClass('mdc-button--spinner').removeAttr('disabled');

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
            let $description = $('<p />').text(description);

            if(action.hasOwnProperty('confirm') && action.confirm) {
                // params dialog
                if(Object.keys(missing_params).length) {
                    let $dialog = UIHelper.createDialog(this.view.getUUID()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                    $dialog.find('.mdc-dialog__content').append($description);
                    await this.decorateViewActionDialog($dialog, action, missing_params);
                    $dialog.addClass('sb-view-dialog').appendTo(this.view.getContainer());
                    $dialog
                    .on('_accept', () => defer.resolve($dialog.data('result')))
                    .on('_reject', () => defer.reject() );
                    $dialog.trigger('_open');
                }
                // confirm dialog
                else {
                    // display confirmation dialog with checkbox for archive
                    let $dialog = UIHelper.createDialog(this.view.getUUID()+'_'+action.id+'_confirm-action-dialog', TranslationService.instant('SB_ACTIONS_CONFIRM'), TranslationService.instant('SB_DIALOG_ACCEPT'), TranslationService.instant('SB_DIALOG_CANCEL'));
                    $dialog.find('.mdc-dialog__content').append($description);
                    $dialog.appendTo(this.view.getContainer());
                    $dialog
                    .on('_accept', () => defer.resolve())
                    .on('_reject', () => defer.reject() );
                    $dialog.trigger('_open');
                }
            }
            else {
                // params dialog
                if(Object.keys(missing_params).length) {
                    let $dialog = UIHelper.createDialog(this.view.getUUID()+'_'+action.id+'_custom_action_dialog', TranslationService.instant('SB_ACTIONS_PROVIDE_PARAMS'), TranslationService.instant('SB_DIALOG_SEND'), TranslationService.instant('SB_DIALOG_CANCEL'));
                    $dialog.find('.mdc-dialog__content').append($description);
                    await this.decorateViewActionDialog($dialog, action, missing_params);
                    $dialog.addClass('sb-view-dialog').appendTo(this.view.getContainer());
                    $dialog
                    .on('_accept', () => defer.resolve($dialog.data('result')))
                    .on('_reject', () => defer.reject() );
                    $dialog.trigger('_open');
                }
                // perform action
                else {
                    defer.resolve()
                }
            }

            defer.promise().then( async (result:any) => {
                this.performViewAction(action, {...resulting_params, ...result}, translation, response_descr);
            });


        });

    }

    protected async decorateViewActionDialog($dialog: JQuery, action: any, params: any) {
        let $elem = $('<div />');

        let widgets:any = {};

        // load translation related to controller
        let translation = await ApiService.getTranslation(action.controller.replaceAll('_', '\\'), this.view.getLocale());

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

    protected async performViewAction(action:any, params:any, translation: any, response_descr: any = {}) {
        console.log('Layout::performViewAction');
        try {
            let content_type:string = 'application/json';

            if(response_descr.hasOwnProperty('content-type')) {
                content_type = response_descr['content-type'];
            }

            const result = await ApiService.fetch("/", {do: action.controller, ...params}, content_type);

            if(content_type != 'application/json') {
                let blob = new Blob([result], {type: content_type});
                let filename = "file.download";
                if(response_descr.hasOwnProperty('content-disposition')) {
                    const parts = response_descr['content-disposition'].split('=');
                    if(parts.length > 1) {
                        filename = parts[1].slice(1, -1);
                    }
                }
                saveAs(blob, filename);
            }

            await this.view.onchangeView();
            // await this.view.getModel().refresh();
            // await this.refresh();
        }
        catch(response) {
            await this.view.displayErrorFeedback(translation, response);
        }
    }

}

export default Layout;