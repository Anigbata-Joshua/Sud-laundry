// Shared foundation.
// Purpose: standardized success response shape used by every controller.

function apiResponse(res, statusCode, data, message = 'Success') {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
    });
}
export default apiResponse;