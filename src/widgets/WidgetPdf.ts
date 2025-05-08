import Widget from "./Widget";
import { View, Layout } from "../equal-lib";
import { UIHelper } from '../material-lib';


export default class WidgetPdf extends Widget {

    constructor(layout: Layout, label: string, value: any, config: {}) {
        super(layout, 'text', label, value, config);
    }

    public change(value: any) {

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
                    this.$elem.append( $('<iframe id=""width="100%" height="100%" allowfullscreen style="border: none;" />').attr('src', '/pdfjs/web/viewer.html?file=' + value) );

                    if(this.config.hasOwnProperty('height') && this.config.height > 0) {
                        this.$elem.css({height: this.config.height+'px'});
                    }
                    this.addFullscreenButton(this.$elem);
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


    private addFullscreenButton($elem: JQuery) {
        let $button = $('<div><i class="fa fa-expand"></i></div>').addClass('pdfjs-custom-fullscreen');

        // #memo - we assume there is max 1 doc per page
        const $iframe = $elem.find('iframe').first();

        function placeFullscreenButton() {
            let rect = $iframe[0].getBoundingClientRect();
            let scroll_top = Math.floor($(window).scrollTop() || 0);
            $button.css({top: scroll_top + rect.top + 1 + 'px', left: (rect.left + rect.width - 30 - 10) + 'px'});
            requestAnimationFrame(placeFullscreenButton);
        }

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

                $('.pdfjs-custom-fullscreen').remove();
                $button.prependTo('body');
                placeFullscreenButton();

                $button.on('click', function (e) {
                    const state = $button.attr('data-state');
                    $button.hide();
                    console.log('button state', state);
                    if(!state || state == 'collapsed') {
                        $button.attr('data-state', 'expanded');
                        $('body').css({'overflow': 'hidden'});
                        $iframe.addClass('pdfjs-custom-iframe-fullscreen');
                        $button.find('i').addClass('fa-compress');
                        $button.find('i').removeClass('fa-expand');
                    }
                    else {
                        $button.attr('data-state', 'collapsed');
                        $('body').css({'overflow': 'auto'});
                        $iframe.removeClass('pdfjs-custom-iframe-fullscreen');
                        $button.find('i').addClass('fa-expand');
                        $button.find('i').removeClass('fa-compress');
                    }
                    $button.show();
                });
            });
        }
    }

}