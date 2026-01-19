import Axios, { AxiosRequestConfig } from 'axios';
import { getToken, getApiBaseUrl, makeUrl } from '.';

// Define a custom Axios instance
export const AXIOS_INSTANCE = Axios.create({ baseURL: getApiBaseUrl() || '' });

// Add interceptor to inject token
AXIOS_INSTANCE.interceptors.request.use((config) => {
    // Dynamically update base URL in case it changed at runtime
    config.baseURL = getApiBaseUrl() || '';

    const token = getToken();
    if (token) {
        config.headers['X-Auth-Token'] = token;
    }
    return config;
});

// Custom instance function expected by Orval
export const customInstance = <T>(url: string, options?: any): Promise<T> => {
    const source = Axios.CancelToken.source();

    // Map RequestInit body to Axios data
    const config: AxiosRequestConfig = {
        url,
        ...options,
        cancelToken: source.token,
    };

    if (options?.body) {
        config.data = options.body;
    }

    const promise = AXIOS_INSTANCE(config);

    return promise as Promise<T>;
};

export default customInstance;
