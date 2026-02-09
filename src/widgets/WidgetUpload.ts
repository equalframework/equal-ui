import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

export default class WidgetUpload extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    private windowDragOverHandler = (e: DragEvent) => e.preventDefault();

    public change(value: any) {
        return this;
    }

    public destroy() {
        window.removeEventListener("dragover", (e) => this.windowDragOverHandler(e));
    }

    public render(): JQuery {
        let value: string = this.value ? this.value : '';
        this.$elem = $('<div />');

        switch(this.mode) {
            case 'edit':
                let $input: JQuery = $('<input type="file" />').hide();
                this.$elem
                    .addClass('sb-dropable')
                    .css({'display': 'flex', 'align-items': 'center', 'flex-direction': 'column', 'justify-content': 'center'})
                    .append($input);

                if(this.config.hasOwnProperty('height') && this.config.height > 0) {
                    this.$elem.css({height: this.config.height + 'px'});
                }

                let $icon = $('<svg height="75" viewBox="0 0 88 72.689" width="90" xmlns="http://www.w3.org/2000/svg" class="w-full"><g data-name="Icon feather-upload-cloud" id="Icon_feather-upload-cloud" transform="translate(2.014 2.012)"><path d="M42.527,33.263,27.263,18,12,33.263" data-name="Path 200" fill="none" id="Path_200" stroke="#ff4081" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" transform="translate(14.732 16.334)"></path><path d="M18,18V52.343" data-name="Path 201" fill="none" id="Path_201" stroke="#ff4081" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" transform="translate(23.995 16.334)"></path><path d="M75.5,63.221a19.079,19.079,0,0,0-9.12-35.831H61.574A30.527,30.527,0,1,0,9.144,55.246" data-name="Path 202" fill="none" id="Path_202" stroke="#ff4081" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" transform="translate(-1.492 -4.503)"></path><path d="M42.527,33.263,27.263,18,12,33.263" data-name="Path 203" fill="none" id="Path_203" stroke="#ff4081" stroke-linecap="round" stroke-linejoin="round" stroke-width="4" transform="translate(14.732 16.334)"></path></g></svg>')
                    .css({'margin': '20px auto', 'width': '25%', 'max-width': '90px', 'min-width': '30px'})
                    .appendTo(this.$elem);

                let $text = $('<div />')
                    .css({'margin': '10px auto', 'text-align': 'center'})
                    .appendTo(this.$elem);

                let $link = $('<a>Parcourir</a>')
                    .css({'font-weight': 'bold', 'cursor': 'pointer'})
                    .on('click', () => $input.trigger('click') );

                $('<div />')
                    .append($link)
                    .append($('<span>&nbsp;' + 'ou déposer le document ici' + '</span>'))
                    .appendTo($text);

                this.addDragListener(this.$elem);

                $input.on('change', async (event:any) => {
                        await this.onuploadFile($input.prop('files')[0]);
                    });

                break;
            case 'view':
            default:
                this.$elem.append('[binary data]');
                break;
        }

        return this.$elem
            .addClass('sb-widget')
            .addClass('sb-widget-mode-' + this.mode)
            .attr('id', this.getId())
            .attr('data-type', this.config.type)
            .attr('data-field', this.config.field)
            .attr('data-usage', this.config.usage || '');
    }

    private async onuploadFile(file: any) {
        this.value = await ( ( blob: any ) => {
            const defer = $.Deferred();

            this.setMeta({
                name: blob.name,
                size: blob.size,
                type: blob.type,
                lastModified: blob.lastModified
            });

            const reader = new FileReader();

            reader.onerror = (e: any) => {
                defer.reject(e);
            };

            const text_extensions = ['.txt', '.md', '.coda', '.cod', '.log', '.csv', '.json', '.yaml', '.yml', '.xml'];
            const is_text = file.type.startsWith('text/') || text_extensions.some(ext => file.name.toLowerCase().endsWith(ext));

            if(is_text) {
                console.debug('WidgetUpload::onuploadFile: reading file as text', file);
                reader.onload = (e: any) => {
                    const base64 = btoa(new Uint8Array(new TextEncoder().encode(e.target.result))
                            .reduce((data, byte) => data + String.fromCharCode(byte), '')
                        );
                    defer.resolve(`data:text/plain;base64,${base64}`);
                };
                reader.readAsText(blob);
            }
            else {
                console.debug('WidgetUpload::onuploadFile: reading file as DATA URL', file);
                reader.onload = (e: any) => {
                    defer.resolve(e.target.result);
                };
                reader.readAsDataURL(blob);
            }

            return defer.promise();
        })(file);

        this.$elem.trigger('_updatedWidget', [false]);

        // #todo - this is a test feature : auto save when uploaded
        setTimeout( () => this.getLayout().getView().triggerAction('ACTION.SAVE'), 250);
    }

    private addDragListener($elem: JQuery) {
        if(window.File && window.FileReader && window.FileList && window.Blob) {
            window.addEventListener("dragover", (e) => this.windowDragOverHandler(e));

            let dragCounter = 0;

            $elem.on("dragenter", (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragCounter++;
                $elem.addClass("highlight");
            });

            $elem.on("dragleave", (event) => {
                event.preventDefault();
                event.stopPropagation();
                dragCounter--;
                if (dragCounter === 0) {
                    $elem.removeClass("highlight");
                }
            });

            $elem.on("dragover", (event) => {
                event.preventDefault();
                event.stopPropagation();
            });

            $elem[0].addEventListener("drop", async (event:any) => {
                dragCounter = 0;
                event.preventDefault();
                event.stopPropagation();
                $elem.removeClass("highlight");
                if(event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length) {
                    await this.onuploadFile(event.dataTransfer.files[0]);
                }
            });
        }
    }


}