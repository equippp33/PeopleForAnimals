import * as SecureStore from "expo-secure-store";

const key = "session_token";
export const getToken = () => SecureStore.getItemAsync(key);
export const deleteToken = () => SecureStore.deleteItemAsync(key);
export const setToken = (v: string) => SecureStore.setItemAsync(key, v);


export const saveSecurely = async (key: any, value: any) => {
    try {
        const jsonValue = JSON.stringify(value)
        await SecureStore.setItemAsync(key, jsonValue)
    } catch (error) {
        throw error;
    }
}

export const fetchSecurely = async (key: any) => {
    try {
        const jsonValue = await SecureStore.getItemAsync(key);
        return jsonValue != null ? JSON.parse
            (jsonValue) : null
    } catch (error) {
        throw error;
    }
}

export const deleteSecurely = async (key: any) => {
    return await SecureStore.deleteItemAsync(key)
}