import Widget from "./Widget";
import { View, Layout } from "../equal-lib";

export default class WidgetPdf extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, label, value, config);
    }

    public change(value: any) {
        return this;
    }

    public render():JQuery {
        let value:string = this.value ? this.value : '';
        switch(this.mode) {
            case 'edit':
            case 'view':
            default:
                if(this.config.layout == 'list') {
                    this.$elem = $("<div />").html(value);
                    this.$elem.attr('title', value);
                }
                else {
                    this.$elem = $('<div class="sb-ui-pdfjs" />');
                    this.$elem.append( $('<iframe id="' + 'widget-pdf_iframe_' + this.getId() + '" width="100%" height="100%" allowfullscreen style="border: none;" />').attr('src', '/pdfjs/web/viewer.html?file=' + value) );

                    if(this.config.hasOwnProperty('height') && this.config.height > 0) {
                        this.$elem.css({height: this.config.height + 'px'});
                    }
                    this.initializePdfControls(this.$elem);
                }
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


    private initializePdfControls($elem: JQuery) {
        let $button = $('<div><i class="fa fa-expand"></i></div>').addClass('pdfjs-custom-fullscreen');

        // #memo - we assume there is max 1 doc per page
        const $iframe = $elem.find('iframe').first();

        // setup button onclick listener
        if(!$iframe.length) {
            console.log('no PDF iframe found');
        }
        else {
            console.log("installing PDF iframe onload");

            $iframe.one("load", (event) => {
                console.log("iframe onload");

                // make sure right toolbar is hidden
                $iframe.contents().find("#toolbarViewerRight").css("display", "none");

                // for small resolution screen, also hide splitToolbarButton
                if(screen.width < 640) {
                    $iframe.contents().find("#toolbarViewerMiddle").css("display", "none");
                }

                $elem.find('.pdfjs-custom-fullscreen').remove();

                $iframe.before($button);

                $button.on('click', function (e) {
                    const state = $button.attr('data-state');
                    $button.hide();
                    console.log('button state', state);
                    if(!state || state == 'collapsed') {
                        $button.attr('data-state', 'expanded');
                        $('body').toggleClass('no-scroll');
                        $elem.addClass('fullscreen');
                        $button.find('i').toggleClass('fa-expand fa-compress');
                    }
                    else {
                        $button.attr('data-state', 'collapsed');
                        $('body').toggleClass('no-scroll');
                        $elem.removeClass('fullscreen');
                        $button.find('i').toggleClass('fa-expand fa-compress');
                    }
                    $button.show();
                });
            });
        }
    }

}