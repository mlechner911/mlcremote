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
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Custom instance function expected by Orval
export const customInstance = <T>(config: AxiosRequestConfig, options?: AxiosRequestConfig): Promise<T> => {
    const source = Axios.CancelToken.source();
    const promise = AXIOS_INSTANCE({
        ...config,
        ...options,
        cancelToken: source.token,
    });

    return promise as Promise<T>;
    return promise;
};

export default customInstance;
