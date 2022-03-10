import Widget from "./Widget";
import Layout from "../Layout";

import { UIHelper } from '../material-lib';

import Quill from "quill";

export default class WidgetText extends Widget {


    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'text', label, value, config);
    }

    public change(value: any) {
        // this.$elem.find('textarea').val(value).trigger('change');
        if(this.$elem.data('quill')) {
            let editor = this.$elem.data('quill');
            editor.root.innerHTML = value;
        }
    }

    public render():JQuery {
        let value:string = this.value?this.value:'';
        switch(this.mode) {
            case 'edit':
                this.$elem = $('<div class="sb-ui-textarea" />');

                let $editor = $('<div quill__editor></div>');

                this.$elem.append($editor);

                this.getLayout().getView().isReady().then( () => {
                    // init inline styling
                    var ColorClass = Quill.import('attributors/class/color');
                    var SizeStyle = Quill.import('attributors/style/size');
                    var AlignStyle = Quill.import('attributors/style/align');
                    Quill.register(ColorClass, true);
                    Quill.register(SizeStyle, true);
                    Quill.register(AlignStyle,true);

                    const editor = new Quill($editor[0], {
                        placeholder: this.config.description,
                        theme: "snow",
                        modules: {
                            toolbar: [
                                ['bold', 'italic', 'underline', 'strike'],
                                ['blockquote'],
                                // [{ 'header': [1, 2, 3, 4, 5, 6, false]}],
                                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                                [{ "align": '' }, { "align": 'center' }, { 'align': 'right' }],
                                [{ 'size': ['small', false, 'large', 'huge'] }]  
                              ]
                          }
                    });

                    this.$elem.data('quill', editor);

                    editor.root.innerHTML = value;

                    editor.on('text-change', (delta, source) => {
                        this.value = editor.root.innerHTML;
                        // update value without refreshing the layout
                        if(this.value != value) {
                            this.$elem.trigger('_updatedWidget', [false]);
                        }                        
                    })

                })

                break;
            case 'view':
            default:            
                this.$elem = $('<div class="sb-ui-textarea" />').append( $('<div class="textarea-content" />').html(value) );                
                break;
        }

        this.$elem.append( $('<div class="textarea-title" />').text(this.label) );

        this.$elem.addClass('sb-widget').addClass('sb-widget-mode-'+this.mode).attr('id', this.getId());
        return this.$elem;

    }

}