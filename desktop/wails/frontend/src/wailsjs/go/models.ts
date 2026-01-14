export namespace app {
	
	export class SSHDeployRequest {
	    host: string;
	    user: string;
	    port: number;
	    password: string;
	    identityFile: string;
	
	    static createFrom(source: any = {}) {
	        return new SSHDeployRequest(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.host = source["host"];
	        this.user = source["user"];
	        this.port = source["port"];
	        this.password = source["password"];
	        this.identityFile = source["identityFile"];
	    }
	}

}

export namespace backend {
	
	export class SessionInfo {
	    running: boolean;
	    version: string;
	    updated: string;
	    token: string;
	
	    static createFrom(source: any = {}) {
	        return new SessionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.running = source["running"];
	        this.version = source["version"];
	        this.updated = source["updated"];
	        this.token = source["token"];
	    }
	}

}

export namespace config {
	
	export class TaskDef {
	    id: string;
	    name: string;
	    command: string;
	    color: string;
	    icon: string;
	    showOnLaunch: boolean;
	
	    static createFrom(source: any = {}) {
	        return new TaskDef(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.command = source["command"];
	        this.color = source["color"];
	        this.icon = source["icon"];
	        this.showOnLaunch = source["showOnLaunch"];
	    }
	}
	export class ConnectionProfile {
	    id: string;
	    name: string;
	    color: string;
	    user: string;
	    host: string;
	    port: number;
	    localPort: number;
	    identityFile: string;
	    isWindows: boolean;
	    lastUsed: number;
	    extraArgs: string[];
	    remoteOS: string;
	    remoteArch: string;
	    remoteVersion: string;
	    mode: string;
	    tasks: TaskDef[];
	
	    static createFrom(source: any = {}) {
	        return new ConnectionProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.color = source["color"];
	        this.user = source["user"];
	        this.host = source["host"];
	        this.port = source["port"];
	        this.localPort = source["localPort"];
	        this.identityFile = source["identityFile"];
	        this.isWindows = source["isWindows"];
	        this.lastUsed = source["lastUsed"];
	        this.extraArgs = source["extraArgs"];
	        this.remoteOS = source["remoteOS"];
	        this.remoteArch = source["remoteArch"];
	        this.remoteVersion = source["remoteVersion"];
	        this.mode = source["mode"];
	        this.tasks = this.convertValues(source["tasks"], TaskDef);
	    }
	
		convertValues(a: any, classs: any, asMap: boolean = false): any {
		    if (!a) {
		        return a;
		    }
		    if (a.slice && a.map) {
		        return (a as any[]).map(elem => this.convertValues(elem, classs));
		    } else if ("object" === typeof a) {
		        if (asMap) {
		            for (const key of Object.keys(a)) {
		                a[key] = new classs(a[key]);
		            }
		            return a;
		        }
		        return new classs(a);
		    }
		    return a;
		}
	}

}

