
import { View, Layout } from "./equal-lib";

import { LayoutList } from "./layouts/LayoutList";
import { LayoutForm } from "./layouts/LayoutForm";
import { LayoutDashboard } from "./layouts/LayoutDashboard";


export class LayoutFactory {

    /**
     * Layout factory : maps type guessed from view with a specific layout.
     * @param {View} view
     */
    public static getLayout(view: View): Layout {
        let type = view.getType();

        switch(type) {
            case 'list':
                return new LayoutList(view);
            case 'form':
                return new LayoutForm(view);
            case 'dashboard':
                return new LayoutDashboard(view);
        }
        return new Layout(view);
    }

}