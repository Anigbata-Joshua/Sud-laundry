// Shared foundation.
// Purpose: wraps async controllers so errors are passed to next() automatically.
// instead of needing a try/catch in every single controller.

const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};

export default asyncHandler;