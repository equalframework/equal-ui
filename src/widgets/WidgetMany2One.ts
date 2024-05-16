import Widget from "./Widget";
import { UIHelper } from '../material-lib';
import { ApiService, TranslationService } from "../equal-services";

import { View, Layout } from "../equal-lib";
import Domain from "../Domain";

export default class WidgetMany2One extends Widget {


    constructor(layout: Layout, label: string, value: any, config: any) {
        super(layout, 'many2one', label, value, config);
    }

    public render():JQuery {
        console.debug('WidgetMany2One::render', this.config, this.value);
        // in view mode, we should have received a string
        // in edit mode (or after a view refresh), a map `{id: , name: }`
        let value:any = (!this.value)?'':((typeof this.value == 'object' && this.value.hasOwnProperty('name'))?this.value.name:this.value.toString());
        let domain:any = [];
        if(this.config.hasOwnProperty('domain')) {
            domain = this.config.domain;
        }

        // remember original value
        this.config.original_value = value;

        // #todo : display many2one as sub-forms

        // on right side of widget, add an icon to open the target object (current selection) into a new context
        let $button_open = UIHelper.createButton('m2o-actions-open-'+this.id, '', 'icon', 'open_in_new');
        let $button_create = UIHelper.createButton('m2o-actions-create-'+this.id, '', 'icon', 'add');

        switch(this.mode) {

            case 'edit':
                let objects:Array<any> = [];
                this.$elem = $('<div />');

                let $button_reset = UIHelper.createButton('m2o-actions-reset-'+this.id, '', 'icon', 'close').css({"position": "absolute", "right": "45px", "top": "5px", "z-index": "1"}).hide();

                let $select = UIHelper.createInput('m2o-input-'+this.id, this.label, value, this.config.description, '', this.readonly)
                    .addClass('mdc-menu-surface--anchor')
                    .css({"width": "100%", "display": "inline-block"});

                let $input = $select.find('input');
                let $menu = UIHelper.createMenu('m2o-menu-'+this.id).appendTo($select);
                let $menu_list = UIHelper.createList('m2o-menu-list-'+this.id).appendTo($menu);
                let $link_search = UIHelper.createListItem('m2o-actions-search-'+this.id, '<a style="text-decoration: underline;">'+TranslationService.instant('SB_WIDGETS_MANY2ONE_ADVANCED_SEARCH')+'</a>');
                let $link_instant = UIHelper.createListItem('m2o-actions-instant-'+this.id, '<a style="text-decoration: underline;">'+TranslationService.instant('SB_ACTIONS_BUTTON_CREATE')+' "{value}"'+'</a>');

                if(this.config.has_action_open || this.config.has_action_create) {
                    $select.css({"width": "calc(100% - 48px)"});
                }

                UIHelper.decorateMenu($menu);

                $button_reset.on('click', (event:any) => {
                    this.value = {id: 0, name:''};
                    $select.attr('data-selected', 0);
                    $select.find('input').val('').trigger('change');
                    $button_reset.hide();
                    $select.find('input').prop('readonly', false);
                    this.$elem.trigger('_updatedWidget');
                });

                if(value.length) {
                    $button_create.hide();
                }
                else {
                    $button_open.hide();
                }

                this.$elem.append($select);

                if(this.config.hasOwnProperty('object_id') && this.config.object_id > 0) {
                    $select.attr('data-selected', this.config.object_id);
                }

                if(!this.config.has_action_open) {
                    $button_open.hide();
                }
                else {
                    this.$elem.append($button_open);
                    // open targeted object in new context
                    $button_open.on('click', async () => {
                        if(this.config.hasOwnProperty('object_id')) {
                            await this.getLayout().openContext({
                                entity: this.config.foreign_object,
                                type: 'form',
                                mode: 'edit',
                                name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                domain: ['id', '=', this.config.object_id],
                                callback: (data:any) => {
                                    if(data && data.selection && data.objects && data.selection.length) {
                                        // we should have received a single (partial) object with up-to-date name and id
                                        let object = data.objects.find( (o:any) => o.id == data.selection[0] );
                                        this.value = {id: object.id, name: object.name};
                                        // update widget displayed value in case it is not part of a view (e.g. filters)
                                        $select.find('input').val(object.name).trigger('change');
                                        this.$elem.trigger('_updatedWidget');
                                    }
                                }
                            });
                        }
                    });
                }

                if(!this.config.has_action_create) {
                    $button_create.hide();
                }
                else {
                    this.$elem.append($button_create);
                    // open creation form in new context
                    $button_create.on('click', async () => {
                        let contextDomain = new Domain(domain);
                        let value:string = <string> $select.find('input').val();
                        if(value.length > 0) {
                            contextDomain.merge(new Domain(['name', '=', value]));
                        }
                        try {
                            await this.getLayout().openContext({
                                entity: this.config.foreign_object,
                                type: 'form',
                                mode: 'edit',
                                purpose: 'create',
                                domain: contextDomain.toArray(),
                                name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                callback: (data:any) => {
                                    if(data && data.selection && data.objects && data.selection.length) {
                                        $button_create.hide();
                                        $button_open.show();
                                        // m2o relations are always loaded as an object with {id:, name:}
                                        let object = data.objects.find( (o:any) => o.id == data.selection[0] );
                                        this.value = {id: object.id, name: object.name};
                                        // update widget displayed value in case it is not part of a view (e.g. filters)
                                        $select.find('input').val(object.name).trigger('change');
                                        this.$elem.trigger('_updatedWidget');
                                    }
                                }
                            });
                        }
                        catch(response) {
                            console.warn('request failed', response);
                            this.getLayout().getView().displayErrorFeedback(this.getLayout().getView().getTranslation(), response);
                        }
                    });
                }

                let createInstant = async () => {
                    let value:string = <string> $select.find('input').val();
                    if(value.length <= 0) {
                        return;
                    }
                    // attempt create a new item based with value as name
                    try {
                        let object = await ApiService.create(this.config.foreign_object, {name: value});
                        // if successful, select the newly created item
                        this.value = {id: object.id, name: value};
                        // update widget displayed value in case it is not part of a view (e.g. filters)
                        $input.val(value).trigger('change');
                        this.$elem.trigger('_updatedWidget');
                    }
                    catch(response) {
                        console.warn('request failed', response);
                        this.getLayout().getView().displayErrorFeedback(this.getLayout().getView().getTranslation(), response);
                    }
                };

                let openSelectContext = () => {
                    this.getLayout().openContext({...this.config,
                        entity: this.config.foreign_object,
                        /*
                        type: (this.config.hasOwnProperty('view_type'))?this.config.view_type:'list',
                        name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                        */
                        type: 'list',
                        name: 'default',
                        domain: domain,
                        mode: 'view',
                        purpose: 'select',
                        limit: 25,
                        callback: (data:any) => {
                            if(data && data.selection && data.objects && data.selection.length) {
                                // m2o relations are always loaded as an object with {id:, name:}
                                let object = data.objects.find( (o:any) => o.id == data.selection[0] );
                                this.value = {id: object.id, name: object.name};
                                // update widget displayed value in case it is not part of a view (e.g. filters)
                                $select.find('input').val(object.name).trigger('change');
                                // trigger parent view refresh
                                this.$elem.trigger('_updatedWidget');
                            }
                        }
                    });
                };

                let query = '';

                let feedObjects = async () => {
                    console.debug('WidgetMany2One::feedObjects (call)');
                    if(!$input.length) {
                        return;
                    }
                    let val = <string> $input.val();
                    let parts:string[] = val.split(" ");

                    if(val != query || !objects.length) {
                        query = val;

                        let domainArray = [];
                        for(let word of parts) {
                            let cond = ['name', 'ilike', '%'+word+'%'];
                            domainArray.push(cond);
                        }
                        let tmpDomain = new Domain(domainArray);
                        tmpDomain.merge(new Domain(domain));
                        // fetch first objects from config.foreign_object (use config.domain) + add an extra line ("advanced search...")
                        let limit = (this.config.hasOwnProperty('limit') && this.config.limit)?this.config.limit:5;
                        let order = (this.config.hasOwnProperty('order') && this.config.order)?this.config.order:'id';
                        let sort  = (this.config.hasOwnProperty('sort') && this.config.sort)?this.config.sort:'asc';

                        try {
                            let response = await ApiService.collect(this.config.foreign_object, tmpDomain.toArray(), ['id', 'name'], order, sort, 0, limit, this.config.lang);
                            objects = response;
                            $menu_list.empty();
                            for(let object of objects) {
                                UIHelper.createListItem(this.id+'-object-'+object.id, object.name.replaceAll(' ', '&nbsp;'))
                                    .appendTo($menu_list)
                                    .attr('id', object.id)
                                    // #memo - a handler is set on item click as well in the menu
                                    .on('click', (event) => {
                                        console.log('WidgetMany2one: received click on item', object.id);
                                        $select.attr('data-selected', object.id);
                                        $input.val(object.name).trigger('change');
                                        $button_reset.show();
                                        $select.find('input').prop('readonly', true);
                                        $select.trigger('update');
                                    })
                            }
                            if(objects.length) {
                                if(objects.length == 1 && (!this.config.hasOwnProperty('autoselect') || this.config.autoselect == true)) {
                                    // if list is exactly 1 object long : auto select
                                    let object = objects[0];
                                    $select.attr('data-selected', object.id);
                                    $input.val(object.name).trigger('change');
                                    $select.trigger('update');
                                }
                                else {
                                    $menu_list.append(UIHelper.createListDivider());
                                }
                            }
                            // advanced search button
                            $link_search.on('click', openSelectContext);
                            $menu_list.append($link_search);
                            // instant creation link
                            if(val.length > 0 && this.config.has_action_create) {
                                let $label = $link_instant.find('a');
                                $label.text($label.text().replace('{value}', val));
                                $link_instant.on('click', () => createInstant());
                                $menu_list.append($link_instant);
                            }
                        }
                        catch(response) {
                            console.warn('request failed', response);
                        }
                    }

                    // make the menu sync with its parent width (menu is 'fixed')
                    $select.find('.mdc-menu-surface').width(<number>$select.width());
                };

                if(this.config.layout == 'form' && !this.readonly) {
                    console.debug('WidgetMany2One: setting up listener on $select');

                    if(!this.config.has_action_open && !this.config.has_action_create) {
                        $button_reset.css({"right": "5px"});
                    }

                    // make room for reset button
                    $select.find('input').css({'width': 'calc(100% - 50px)'});
                    // insert before other buttons, if any, to respect tabindex
                    $button_reset.insertAfter($select);

                    if(value.length && !this.readonly) {
                        $button_reset.show();
                        $select.find('input').prop('readonly', true);
                    }

                    // debounce
                    let timeout:any = null;

                    $select.find('input').on('keydown', (event:any) => {
                            console.debug('WidgetMany2One: $select received keydown');
                            // tab
                            if(event.which == 9) {
                                $menu.trigger('_close');
                            }
                        });

                    $select.find('input').on('keyup', (event:any) => {
                        console.debug('WidgetMany2One: $select received keyup');
                        // tab
                        if(event.which == 9) {
                            // do nothing
                        }
                        // esc
                        else if(event.which == 27) {
                            // revert to initial value, if any
                            $select.find('input').val(this.config.original_value).trigger('change');
                            $select.attr('data-selected', 0);
                            if(this.config.original_value.length) {
                                $button_reset.show();
                                $select.find('input').prop('readonly', true);
                            }
                            $menu.trigger('_close');
                        }
                        // enter
                        else if(event.which == 13) {
                            // #memo - this triggers a click on the menu, which triggers a menu close
                            $menu.trigger('_select');
                        }
                        // up arrow
                        else if(event.which == 38) {
                            $menu.trigger('_moveup');
                        }
                        // down arrow
                        else if(event.which == 40) {
                            $menu.trigger('_movedown');
                        }
                        // new char
                        else {
                            // update results
                            let original_instant_label:string = TranslationService.instant('SB_ACTIONS_BUTTON_CREATE')+' "{value}"';
                            $link_instant.find('a').text(original_instant_label.replace('{value}', <string> $select.find('input').val()));
                            if(timeout) {
                                clearTimeout(timeout);
                            }
                            timeout = setTimeout( async () => {
                                timeout = null;
                                await feedObjects();
                                $menu.trigger('_resize');
                                $menu.trigger('_reset');
                            }, 250);
                        }
                    });
                }
                else {
                    console.debug('WidgetMany2One:: ignored setting up listener on $select');
                }

                // upon value change, relay updated value to parent layout
                $select.on('update', (event) => {
                    console.debug('WidgetMany2One: received update event', $select.attr('data-selected'));
                    // m2o relations are always loaded as an object with {id:, name:}
                    let object:any = objects.find( o => o.id == $select.attr('data-selected'));
                    if(object) {
                        if(this.config.has_action_open) {
                            $button_open.show();
                        }
                        $button_create.hide();
                        this.value = {id: object.id, name: object.name};
                        // #memo - this will give the focus back to the input
                        this.$elem.trigger('_updatedWidget');
                    }
                    else {
                        if(this.config.has_action_create) {
                            $button_create.show();
                        }
                        $button_open.hide();
                    }
                });

                // #memo - dealing with blur event leads to edge cases
                /*
                $select.find('input').on('blur', (event:any) => {
                    event.stopPropagation();
                    // blur can result from a click on an item, wait for the click handler to proceed
                    setTimeout( () => {
                        $menu.trigger('_close');
                    }, 100);
                });
                */

                $select.find('input').on('focus', async (event:any) => {
                    let selection: number = parseInt(<string> $select.attr('data-selected')) || 0;
                    console.debug('WidgetMany2one: received focus event on input', $select.attr('data-selected'), selection);
                    if(selection == 0 && !$menu.hasClass('mdc-menu-surface--open')) {
                        await feedObjects();
                        $menu.trigger('_open');
                    }
                });

                // #memo - we condition load on init to fields with empty values AND having a domain set
                // (to prevent burst requests when view is displayed in edit mode)
                /*
                if( (!value || !value.length) && domain.length) {
                    setTimeout( async () => {
                            await feedObjects();
                            $menu.trigger('_open');
                        }, 250);
                }
                */
                break;
            case 'view':
            default:
                this.$elem = $('<div />');
                let $viewInput = UIHelper.createInputView('', this.label, value, this.config.description);

                switch(this.config.layout) {
                    case 'form':
                        $viewInput.css({"width": "calc(100% - 48px)", "display": "inline-block"});

                        this.$elem.append($viewInput);

                        if(this.config.has_action_open) {
                            this.$elem.append($button_open);
                            // open targeted object in new context
                            $button_open.on('click', async () => {
                                if(this.config.hasOwnProperty('object_id') && this.config.object_id && this.config.object_id > 0) {
                                    this.getLayout().openContext({
                                        entity: this.config.foreign_object,
                                        type: 'form',
                                        name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                        domain: ['id', '=', this.config.object_id]
                                    });
                                }
                            });
                        }
                        break;
                    case 'list':
                    default:
                        // by convention, first column of each row opens the object no matter the type of the field
                        if(this.is_first) {
                            this.$elem.addClass('is-first');
                        }

                        this.$elem.text(value);
                        this.$elem.css({"width": "100%", "height": "auto", "max-height": "calc(44px - 2px)", "white-space": "break-spaces", "overflow": "hidden", "cusor": "pointer"});

                        if(!this.is_first) {
                            // open targeted object in new context
                            this.$elem.on('click', async (event: any) => {
                                this.getLayout().openContext({
                                    entity: this.config.foreign_object,
                                    type: 'form',
                                    name: (this.config.hasOwnProperty('view_name'))?this.config.view_name:'default',
                                    domain: ['id', '=', this.config.object_id]
                                });
                                event.stopPropagation();
                            });
                        }
                }
                break;
        }


        return this.$elem.addClass('sb-widget').addClass('sb-widget-type-many2one').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId()).attr('data-type', this.config.type).attr('data-usage', this.config.usage||'');
    }
}