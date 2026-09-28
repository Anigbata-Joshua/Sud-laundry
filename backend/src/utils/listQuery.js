import ApiError from './apiError.js';

export function textQuery(value, field) {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || value.trim().length > 200) {
        throw new ApiError(400, `${field} must be a string of at most 200 characters`);
    }
    return value.trim();
}

export function literalSearch(value) {
    return { $regex: value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
}

export function paginationQuery(query) {
    if (query.page === undefined && query.limit === undefined) return null;
    const parse = (value, fallback, max, name) => {
        if (value === undefined) return fallback;
        if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
            throw new ApiError(400, `${name} must be an integer between 1 and ${max}`);
        }
        return Number(value);
    };
    const page = parse(query.page, 1, 1000000, 'page');
    const limit = parse(query.limit, 20, 100, 'limit');
    return { page, limit, skip: (page - 1) * limit };
}
