
import { DataModelMethods } from "@cloudbase/wx-cloud-client-sdk";
interface IModalSysUser {

}


interface IModels {

    /**
    * 数据模型：用户
    */ 
    sys_user: DataModelMethods<IModalSysUser>;    
}

declare module "@cloudbase/wx-cloud-client-sdk" {
    interface OrmClient extends IModels {}
}

declare global {
    interface WxCloud {
        models: IModels;
    }
}