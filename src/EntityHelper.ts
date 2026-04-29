export interface EntityParts {
    packageName: string;
    className: string;
}

export default class EntityHelper {

    public static parse(entity: string): EntityParts {
        const separatorIndex = entity.indexOf('\\');

        if(separatorIndex < 0) {
            return {
                packageName: '',
                className: entity
            };
        }

        return {
            packageName: entity.substring(0, separatorIndex),
            className: entity.substring(separatorIndex + 1)
        };
    }

    public static getPackageName(entity: string): string {
        return EntityHelper.parse(entity).packageName;
    }

    public static getClassName(entity: string): string {
        return EntityHelper.parse(entity).className;
    }
}
