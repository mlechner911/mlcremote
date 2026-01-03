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

export namespace config {
	
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
	    }
	}

}

