# Authentication Endpoints

<cite>
**Referenced Files in This Document**
- [auth.py](file://backend/app/api/v1/auth.py)
- [auth.py](file://backend/app/schemas/auth.py)
- [auth_service.py](file://backend/app/services/auth_service.py)
- [security.py](file://backend/app/core/security.py)
- [deps.py](file://backend/app/core/deps.py)
- [rate_limit.py](file://backend/app/core/rate_limit.py)
- [email_service.py](file://backend/app/services/email_service.py)
- [config.py](file://backend/app/core/config.py)
- [database.py](file://backend/app/models/database.py)
- [auth.service.ts](file://frontend/src/services/auth.service.ts)
- [auth.ts](file://frontend/src/types/auth.ts)
</cite>

## Update Summary
**Changes Made**
- Updated authentication architecture to use cookie-based authentication with httpOnly cookies
- Implemented dual-token authentication system with separate access and refresh tokens
- Added automatic refresh capabilities for seamless user experience
- Enhanced rate limiting implementation with comprehensive sliding window protection
- Updated all endpoints to work with cookie-based session management
- Modified frontend integration patterns for cookie handling

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Cookie-Based Authentication System](#cookie-based-authentication-system)
7. [Dual-Token Authentication](#dual-token-authentication)
8. [Automatic Refresh Mechanism](#automatic-refresh-mechanism)
9. [Rate Limiting Implementation](#rate-limiting-implementation)
10. [Dependency Analysis](#dependency-analysis)
11. [Performance Considerations](#performance-considerations)
12. [Troubleshooting Guide](#troubleshooting-guide)
13. [Conclusion](#conclusion)

## Introduction
This document provides comprehensive API documentation for the authentication system that has migrated from token-based to cookie-based authentication. The system now implements a dual-token authentication system with httpOnly cookies, automatic refresh capabilities, and comprehensive rate limiting. It covers all authentication-related HTTP endpoints including registration, login, password reset, logout, and user information retrieval. The documentation details HTTP methods, URL patterns, request/response schemas, authentication requirements, parameter validation rules, error handling, verification code system, JWT token generation, and session management with cookies.

## Project Structure
The authentication system is implemented in the backend using FastAPI and structured into several key components with cookie-based session management:
- API endpoints: Define HTTP routes and request/response handling with cookie management
- Schemas: Define request/response data validation using Pydantic
- Services: Implement business logic for authentication operations with dual-token support
- Security: Handle JWT token creation/verification and password hashing with dual-token types
- Dependencies: Manage authentication middleware and user context with cookie extraction
- Rate Limiting: Implement comprehensive sliding window rate limiting
- Email service: Handle verification code delivery via email
- Database models: Define User and VerificationCode entities

```mermaid
graph TB
subgraph "Backend"
API["API Router<br/>/auth endpoints with Cookie Management"]
Schemas["Pydantic Schemas<br/>Request/Response Models"]
Service["AuthService<br/>Business Logic with Dual-Tokens"]
Security["Security<br/>JWT & Password with Dual-Token Types"]
Deps["Dependencies<br/>Auth Middleware with Cookie Extraction"]
RateLimit["Rate Limiter<br/>Sliding Window Protection"]
Email["Email Service<br/>SMTP Delivery"]
Models["Database Models<br/>User & VerificationCode"]
end
subgraph "Frontend"
FrontendService["Auth Service<br/>SDK Integration"]
Types["Type Definitions<br/>TS Interfaces"]
end
FrontendService --> API
API --> Service
Service --> Security
Service --> Email
Service --> Models
API --> Schemas
API --> Deps
API --> RateLimit
Deps --> Security
Deps --> Models
FrontendService --> Types
```

**Diagram sources**
- [auth.py:32](file://backend/app/api/v1/auth.py#L32)
- [auth_service.py:16](file://backend/app/services/auth_service.py#L16)
- [security.py:13](file://backend/app/core/security.py#L13)
- [deps.py:18](file://backend/app/core/deps.py#L18)
- [rate_limit.py:10](file://backend/app/core/rate_limit.py#L10)
- [email_service.py:25](file://backend/app/services/email_service.py#L25)
- [database.py:13](file://backend/app/models/database.py#L13)

**Section sources**
- [auth.py:1-446](file://backend/app/api/v1/auth.py#L1-L446)
- [auth.py:1-106](file://backend/app/schemas/auth.py#L1-L106)
- [auth_service.py:1-358](file://backend/app/services/auth_service.py#L1-L358)

## Core Components
The authentication system consists of several interconnected components that work together to provide secure user authentication with cookie-based session management:

### Request/Response Schemas
The system uses Pydantic models to define and validate all request and response data structures. These schemas ensure data integrity and provide automatic validation and serialization for both token-based and cookie-based operations.

### Business Logic Layer
The AuthService class encapsulates all authentication-related business logic, including verification code generation, user registration, login operations, password reset functionality, and dual-token management.

### Security Layer
Handles JWT token creation and verification with dual-token types (access and refresh), password hashing using bcrypt, and token expiration management with different expiration policies.

### Rate Limiting System
Implements comprehensive sliding window rate limiting with different thresholds for verification code sending and authentication attempts to prevent abuse and spam attacks.

### Cookie Management
Manages httpOnly cookie-based session storage with secure configuration, automatic refresh mechanisms, and seamless integration with the dual-token system.

**Section sources**
- [auth.py:10-106](file://backend/app/schemas/auth.py#L10-L106)
- [auth_service.py:16-358](file://backend/app/services/auth_service.py#L16-L358)
- [security.py:13-87](file://backend/app/core/security.py#L13-L87)
- [rate_limit.py:10-58](file://backend/app/core/rate_limit.py#L10-L58)

## Architecture Overview
The authentication system follows a layered architecture with clear separation of concerns and cookie-based session management:

```mermaid
sequenceDiagram
participant Client as "Client Application"
participant API as "Auth API Router"
participant Service as "AuthService"
participant Security as "Security Layer"
participant RateLimit as "Rate Limiter"
participant Email as "Email Service"
participant DB as "Database"
Client->>API : Request Authentication Operation
API->>RateLimit : Check Rate Limits
RateLimit-->>API : Rate Limit Status
API->>Service : Delegate Business Logic
Service->>Security : Create/Verify Tokens
Service->>Email : Send Verification Code
Email-->>Service : Delivery Status
Service->>DB : Database Operations
DB-->>Service : Query Results
Service-->>API : Business Results
API->>API : Set httpOnly Cookies
API-->>Client : Response with Cookie-based Session
```

**Diagram sources**
- [auth.py:63](file://backend/app/api/v1/auth.py#L63)
- [auth_service.py:19](file://backend/app/services/auth_service.py#L19)
- [security.py:48](file://backend/app/core/security.py#L48)
- [rate_limit.py:38](file://backend/app/core/rate_limit.py#L38)
- [email_service.py:48](file://backend/app/services/email_service.py#L48)
- [database.py:13](file://backend/app/models/database.py#L13)

## Detailed Component Analysis

### Registration Endpoints

#### Send Registration Code (`POST /auth/register/send-code`)
Sends a 6-digit verification code to the user's email for registration with comprehensive rate limiting.

**HTTP Method:** POST  
**URL Pattern:** `/auth/register/send-code`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `type`: string (optional) - Must be "register" if provided

**Response Schema:**
- `success`: boolean - Operation status
- `message`: string - Operation result message

**Rate Limiting:**
- Sliding window: 5 requests per minute per IP address
- Uses `send_code_limiter` for verification code rate protection

**Validation Rules:**
- Email must be valid format
- Type field, if present, must equal "register"

**Common Error Responses:**
- 400 Bad Request: Invalid email format, type mismatch, or rate limit exceeded
- 429 Too Many Requests: Exceeded rate limit

**Section sources**
- [auth.py:63](file://backend/app/api/v1/auth.py#L63-L94)
- [auth.py:75](file://backend/app/api/v1/auth.py#L75)
- [rate_limit.py:54](file://backend/app/core/rate_limit.py#L54)

#### Verify Registration Code (`POST /auth/register/verify`)
Verifies a registration verification code without completing registration with authentication rate limiting.

**HTTP Method:** POST  
**URL Pattern:** `/auth/register/verify`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `code`: string (required) - 6-digit verification code
- `type`: string (optional) - Must be "register" if provided

**Response Schema:**
- `success`: boolean - Operation status
- `message`: string - Operation result message

**Rate Limiting:**
- Sliding window: 10 requests per minute per IP address
- Uses `auth_limiter` for authentication attempt rate protection

**Validation Rules:**
- Email must be valid format
- Code must be exactly 6 digits
- Type field, if present, must equal "register"
- Code must match unexpired, unused verification code

**Common Error Responses:**
- 400 Bad Request: Invalid code, expired code, or user already registered
- 429 Too Many Requests: Rate limit exceeded

**Section sources**
- [auth.py:96](file://backend/app/api/v1/auth.py#L96-L128)
- [auth.py:109](file://backend/app/api/v1/auth.py#L109)
- [rate_limit.py:57](file://backend/app/core/rate_limit.py#L57)

#### Complete Registration (`POST /auth/register`)
Registers a new user account using email and password, returning dual tokens via httpOnly cookies.

**HTTP Method:** POST  
**URL Pattern:** `/auth/register`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `code`: string (required) - 6-digit verification code
- `password`: string (required) - User's password (minimum 6 characters)
- `username`: string (optional) - User's display name

**Response Schema:**
- `access_token`: string - JWT access token
- `token_type`: string - Token type (always "bearer")
- `user`: object - User information (id, email, username, etc.)

**Cookie Management:**
- Sets httpOnly cookies for both access_token and refresh_token
- Access token: 30 minutes expiration
- Refresh token: 7 days expiration
- Secure flags set appropriately for production

**Rate Limiting:**
- Sliding window: 10 requests per minute per IP address
- Uses `auth_limiter` for authentication attempt rate protection

**Validation Rules:**
- Email must be valid format
- Code must be exactly 6 digits
- Password must be at least 6 characters
- Username must be 50 characters or less
- Code must be verified and unexpired
- Email must not already exist

**Common Error Responses:**
- 400 Bad Request: Invalid input, expired code, or email already registered
- 429 Too Many Requests: Rate limit exceeded

**Section sources**
- [auth.py:130](file://backend/app/api/v1/auth.py#L130-L175)
- [auth.py:146](file://backend/app/api/v1/auth.py#L146)
- [auth.py:35](file://backend/app/api/v1/auth.py#L35-L54)

### Login Endpoints

#### Send Login Code (`POST /auth/login/send-code`)
Sends a 6-digit verification code to the user's email for login with comprehensive rate limiting.

**HTTP Method:** POST  
**URL Pattern:** `/auth/login/send-code`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `type`: string (optional) - Must be "login" if provided

**Response Schema:**
- `success`: boolean - Operation status
- `message`: string - Operation result message

**Rate Limiting:**
- Sliding window: 5 requests per minute per IP address
- Uses `send_code_limiter` for verification code rate protection

**Validation Rules:**
- Email must be valid format
- Type field, if present, must equal "login"

**Common Error Responses:**
- 400 Bad Request: Invalid email format

**Section sources**
- [auth.py:177](file://backend/app/api/v1/auth.py#L177-L207)
- [auth.py:189](file://backend/app/api/v1/auth.py#L189)
- [rate_limit.py:54](file://backend/app/core/rate_limit.py#L54)

#### Code-based Login (`POST /auth/login`)
Logs a user in using a verification code, returning dual tokens via httpOnly cookies.

**HTTP Method:** POST  
**URL Pattern:** `/auth/login`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `code`: string (required) - 6-digit verification code

**Response Schema:**
- `access_token`: string - JWT access token
- `token_type`: string - Token type (always "bearer")
- `user`: object - User information (id, email, username, etc.)

**Cookie Management:**
- Sets httpOnly cookies for both access_token and refresh_token
- Access token: 30 minutes expiration
- Refresh token: 7 days expiration

**Rate Limiting:**
- Sliding window: 10 requests per minute per IP address
- Uses `auth_limiter` for authentication attempt rate protection

**Validation Rules:**
- Email must be valid format
- Code must be exactly 6 digits
- Code must be verified and unexpired
- User must exist and be active

**Common Error Responses:**
- 400 Bad Request: Invalid code, expired code, or user not found

**Section sources**
- [auth.py:209](file://backend/app/api/v1/auth.py#L209-L247)
- [auth.py:223](file://backend/app/api/v1/auth.py#L223)
- [auth.py:35](file://backend/app/api/v1/auth.py#L35-L54)

#### Password Login (`POST /auth/login/password`)
Logs a user in using email and password, returning dual tokens via httpOnly cookies.

**HTTP Method:** POST  
**URL Pattern:** `/auth/login/password`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `password`: string (required) - User's password

**Response Schema:**
- `access_token`: string - JWT access token
- `token_type`: string - Token type (always "bearer")
- `user`: object - User information (id, email, username, etc.)

**Cookie Management:**
- Sets httpOnly cookies for both access_token and refresh_token
- Access token: 30 minutes expiration
- Refresh token: 7 days expiration

**Rate Limiting:**
- Sliding window: 10 requests per minute per IP address
- Uses `auth_limiter` for authentication attempt rate protection

**Validation Rules:**
- Email must be valid format
- Password must be at least 6 characters
- User must exist and be active
- Password must match stored hash

**Common Error Responses:**
- 400 Bad Request: Invalid credentials or user not found

**Section sources**
- [auth.py:249](file://backend/app/api/v1/auth.py#L249-L286)
- [auth.py:263](file://backend/app/api/v1/auth.py#L263)
- [auth.py:35](file://backend/app/api/v1/auth.py#L35-L54)

### Password Reset Endpoints

#### Send Reset Password Code (`POST /auth/reset-password/send-code`)
Sends a 6-digit verification code for password reset with comprehensive rate limiting.

**HTTP Method:** POST  
**URL Pattern:** `/auth/reset-password/send-code`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `type`: string (optional) - Must be "reset" if provided

**Response Schema:**
- `success`: boolean - Operation status
- `message`: string - Operation result message

**Rate Limiting:**
- Sliding window: 5 requests per minute per IP address
- Uses `send_code_limiter` for verification code rate protection

**Validation Rules:**
- Email must be valid format
- Type field, if present, must equal "reset"
- User must already be registered

**Common Error Responses:**
- 400 Bad Request: Invalid email format, user not found

**Section sources**
- [auth.py:288](file://backend/app/api/v1/auth.py#L288-L318)
- [auth.py:300](file://backend/app/api/v1/auth.py#L300)
- [rate_limit.py:54](file://backend/app/core/rate_limit.py#L54)

#### Reset Password (`POST /auth/reset-password`)
Resets a user's password using verification code with comprehensive rate limiting.

**HTTP Method:** POST  
**URL Pattern:** `/auth/reset-password`  
**Authentication:** No authentication required  

**Request Schema:**
- `email`: string (required) - User's email address
- `code`: string (required) - 6-digit verification code
- `new_password`: string (required) - New password (minimum 6 characters)

**Response Schema:**
- `success`: boolean - Operation status
- `message`: string - Operation result message

**Rate Limiting:**
- Sliding window: 10 requests per minute per IP address
- Uses `auth_limiter` for authentication attempt rate protection

**Validation Rules:**
- Email must be valid format
- Code must be exactly 6 digits
- New password must be at least 6 characters
- Code must be verified and unexpired
- User must exist

**Common Error Responses:**
- 400 Bad Request: Invalid code, expired code, or user not found

**Section sources**
- [auth.py:320](file://backend/app/api/v1/auth.py#L320-L345)
- [auth.py:333](file://backend/app/api/v1/auth.py#L333)
- [rate_limit.py:57](file://backend/app/core/rate_limit.py#L57)

### Session Management

#### Logout (`POST /auth/logout`)
Logs out the current user by clearing httpOnly cookies.

**HTTP Method:** POST  
**URL Pattern:** `/auth/logout`  
**Authentication:** Bearer token required  

**Request Schema:** None  
**Response Schema:**
- `success`: boolean - Operation status
- `message`: string - Operation result message

**Cookie Management:**
- Clears both access_token and refresh_token cookies
- Removes httpOnly cookies from browser storage

**Authentication Requirements:**
- Requires valid JWT bearer token or cookie-based authentication
- User must be active

**Common Error Responses:**
- 401 Unauthorized: Invalid or missing token
- 403 Forbidden: User disabled

**Section sources**
- [auth.py:347](file://backend/app/api/v1/auth.py#L347-L355)
- [auth.py:57](file://backend/app/api/v1/auth.py#L57-L61)

#### Get Current User Info (`GET /auth/me`)
Retrieves the currently authenticated user's information using cookie-based authentication.

**HTTP Method:** GET  
**URL Pattern:** `/auth/me`  
**Authentication:** Cookie-based authentication required  

**Request Schema:** None  
**Response Schema:**
- `id`: integer - User ID
- `email`: string - User's email
- `username`: string or null - User's display name
- `avatar_url`: string or null - Avatar URL
- `mbti`: string or null - MBTI personality type
- `social_style`: string or null - Social style
- `current_state`: string or null - Current state
- `catchphrases`: array or null - Catchphrases list
- `is_active`: boolean - Account activation status
- `is_verified`: boolean - Email verification status
- `created_at`: string - Account creation timestamp
- `updated_at`: string - Last update timestamp

**Authentication Requirements:**
- Requires valid access token via httpOnly cookie
- User must be active

**Common Error Responses:**
- 401 Unauthorized: Invalid or missing token
- 403 Forbidden: User disabled
- 400 Bad Request: User not activated

**Section sources**
- [auth.py:409](file://backend/app/api/v1/auth.py#L409-L417)
- [auth.py:410](file://backend/app/api/v1/auth.py#L410)
- [auth.py:411](file://backend/app/api/v1/auth.py#L411)

#### Refresh Access Token (`POST /auth/refresh`)
Refreshes the access token using the refresh token cookie for seamless user experience.

**HTTP Method:** POST  
**URL Pattern:** `/auth/refresh`  
**Authentication:** Refresh token cookie required  

**Request Schema:** None  
**Response Schema:**
- `access_token`: string - New JWT access token
- `token_type`: string - Token type (always "bearer")
- `user`: object - User information (id, email, username, etc.)

**Cookie Management:**
- Validates refresh token from httpOnly cookie
- Issues new access token with updated cookie
- Maintains refresh token cookie unchanged

**Authentication Requirements:**
- Requires valid refresh token via httpOnly cookie
- Refresh token must be of type "refresh"
- User must be active

**Common Error Responses:**
- 401 Unauthorized: Missing or invalid refresh token
- 403 Forbidden: User disabled

**Section sources**
- [auth.py:357](file://backend/app/api/v1/auth.py#L357-L407)

## Cookie-Based Authentication System

The authentication system now implements a comprehensive cookie-based authentication approach with httpOnly cookies for enhanced security:

### Cookie Configuration
- **Access Token Cookie**: `access_token` - httpOnly, 30 minutes expiration
- **Refresh Token Cookie**: `refresh_token` - httpOnly, 7 days expiration
- **Secure Flags**: Disabled for development, should be enabled in production
- **SameSite**: Lax for CSRF protection
- **Path**: Root path for global availability

### Cookie Management Functions
The system provides dedicated functions for cookie manipulation:
- `_set_auth_cookies()`: Sets both access and refresh tokens
- `_clear_auth_cookies()`: Clears authentication cookies
- Automatic cookie extraction from requests

### Frontend Integration
Frontend services automatically handle cookie-based authentication:
- Cookies are sent automatically with each request
- No manual token management required
- Seamless integration with existing API calls

**Section sources**
- [auth.py:35](file://backend/app/api/v1/auth.py#L35-L54)
- [auth.py:57](file://backend/app/api/v1/auth.py#L57-L61)
- [auth.py:357](file://backend/app/api/v1/auth.py#L357-L407)

## Dual-Token Authentication

The system implements a sophisticated dual-token authentication system with distinct roles and expiration policies:

### Token Types and Purposes
- **Access Token**: Short-lived (30 minutes) for routine API operations
- **Refresh Token**: Long-lived (7 days) for seamless token renewal
- **Token Payload**: Contains user ID and token type indicator

### Token Creation Process
1. Successful authentication creates both tokens
2. Access token used for immediate API requests
3. Refresh token stored securely in httpOnly cookie
4. Automatic refresh mechanism handles token renewal

### Token Validation
- Access tokens validated for "access" type
- Refresh tokens validated for "refresh" type
- Separate validation logic prevents token misuse

**Section sources**
- [security.py:48](file://backend/app/core/security.py#L48-L66)
- [security.py:68](file://backend/app/core/security.py#L68-L87)
- [auth.py:162](file://backend/app/api/v1/auth.py#L162-L174)
- [auth.py:234](file://backend/app/api/v1/auth.py#L234-L246)

## Automatic Refresh Mechanism

The system provides seamless automatic refresh capabilities to minimize user disruption:

### Refresh Flow
1. Access token expires during API request
2. Client receives 401 Unauthorized response
3. Automatic refresh request using refresh token cookie
4. New access token issued and stored in cookie
5. Original request retried automatically

### Implementation Details
- Refresh endpoint validates refresh token from cookie
- Issues new access token with updated expiration
- Maintains refresh token cookie unchanged
- Handles user deactivation gracefully

### Frontend Integration
- Automatic retry logic for 401 responses
- Transparent token renewal process
- Minimal impact on user experience

**Section sources**
- [auth.py:357](file://backend/app/api/v1/auth.py#L357-L407)
- [deps.py:18](file://backend/app/core/deps.py#L18-L32)

## Rate Limiting Implementation

The system implements comprehensive rate limiting with sliding window protection:

### Rate Limiting Strategy
- **Sliding Window Algorithm**: Tracks requests within configurable time windows
- **IP-based Throttling**: Prevents abuse from single clients
- **Different Limits**: Separate limits for verification codes and authentication attempts

### Pre-configured Limits
- **Verification Code Sending**: 5 requests per 60 seconds per IP
- **Authentication Attempts**: 10 requests per 60 seconds per IP
- **Memory Storage**: In-memory tracking suitable for single-instance deployments

### Rate Limiter Class
The `RateLimiter` class provides:
- IP address detection with proxy support
- Automatic cleanup of expired requests
- HTTPException integration for 429 responses
- Configurable parameters for different endpoints

### Implementation Examples
- `send_code_limiter`: Used for verification code endpoints
- `auth_limiter`: Used for authentication operation endpoints

**Section sources**
- [rate_limit.py:10](file://backend/app/core/rate_limit.py#L10-L58)
- [auth.py:75](file://backend/app/api/v1/auth.py#L75)
- [auth.py:109](file://backend/app/api/v1/auth.py#L109)
- [auth.py:146](file://backend/app/api/v1/auth.py#L146)
- [auth.py:189](file://backend/app/api/v1/auth.py#L189)
- [auth.py:223](file://backend/app/api/v1/auth.py#L223)
- [auth.py:263](file://backend/app/api/v1/auth.py#L263)
- [auth.py:300](file://backend/app/api/v1/auth.py#L300)
- [auth.py:333](file://backend/app/api/v1/auth.py#L333)

## Dependency Analysis

```mermaid
classDiagram
class AuthAPI {
+send_register_code()
+verify_register_code()
+register()
+send_login_code()
+login()
+login_with_password()
+send_reset_password_code()
+reset_password()
+logout()
+get_current_user_info()
+refresh_access_token()
}
class AuthService {
+send_verification_code()
+verify_code()
+register()
+login()
+login_with_password()
+reset_password()
+create_access_token()
+create_refresh_token()
}
class SecurityLayer {
+verify_password()
+get_password_hash()
+create_access_token()
+create_refresh_token()
+decode_access_token()
}
class RateLimiter {
+check()
+_get_client_ip()
+_cleanup()
}
class EmailService {
+generate_code()
+send_verification_email()
+send_test_email()
}
class DatabaseModels {
+User
+VerificationCode
}
class CookieManager {
+_set_auth_cookies()
+_clear_auth_cookies()
}
AuthAPI --> AuthService : "delegates"
AuthService --> SecurityLayer : "uses"
AuthService --> EmailService : "uses"
AuthService --> DatabaseModels : "manipulates"
AuthAPI --> SecurityLayer : "uses for token validation"
AuthAPI --> CookieManager : "manages cookies"
AuthAPI --> RateLimiter : "uses for rate limiting"
```

**Diagram sources**
- [auth.py:32](file://backend/app/api/v1/auth.py#L32)
- [auth_service.py:16](file://backend/app/services/auth_service.py#L16)
- [security.py:13](file://backend/app/core/security.py#L13)
- [rate_limit.py:10](file://backend/app/core/rate_limit.py#L10)
- [email_service.py:25](file://backend/app/services/email_service.py#L25)
- [database.py:13](file://backend/app/models/database.py#L13)

### Verification Code System

The verification code system implements a comprehensive security mechanism with rate limiting:

```mermaid
flowchart TD
Start([Start Verification Process]) --> ValidateInput["Validate Input Parameters"]
ValidateInput --> CheckRateLimit["Check Rate Limit (Sliding Window)"]
CheckRateLimit --> RateExceeded{"Rate Limit Exceeded?"}
RateExceeded --> |Yes| ReturnRateError["Return 429 Too Many Requests"]
RateExceeded --> |No| CheckUserType["Check Verification Type"]
CheckUserType --> CheckExistingUser["Check Existing User (for register/reset)"]
CheckExistingUser --> UserExists{"User Exists?"}
UserExists --> |Register| CheckEmailUnique["Check Email Uniqueness"]
UserExists --> |Reset| CheckEmailExists["Check Email Registered"]
CheckEmailExists --> |No| ReturnNotFound["Return 400 Not Found"]
CheckEmailUnique --> GenerateCode["Generate 6-Digit Code"]
GenerateCode --> SaveToDB["Save Code to Database"]
SaveToDB --> SendEmail["Send Email via SMTP"]
SendEmail --> EmailSuccess{"Email Sent?"}
EmailSuccess --> |No| RollbackDB["Rollback Transaction"]
RollbackDB --> ReturnEmailError["Return 500 Internal Error"]
EmailSuccess --> |Yes| CommitDB["Commit Transaction"]
CommitDB --> ReturnSuccess["Return Success Response"]
ReturnNotFound --> End([End])
ReturnRateError --> End
ReturnEmailError --> End
ReturnSuccess --> End
```

**Diagram sources**
- [auth_service.py:19](file://backend/app/services/auth_service.py#L19-L98)
- [email_service.py:48](file://backend/app/services/email_service.py#L48-L155)

**Section sources**
- [auth_service.py:19-98](file://backend/app/services/auth_service.py#L19-L98)
- [email_service.py:36](file://backend/app/services/email_service.py#L36-L47)

### JWT Token Generation and Management

The system uses JWT tokens for session management with dual-token types and comprehensive security:

**Token Structure:**
- Access Token: Subject (sub), Email, Expiration (30 minutes), Type ("access")
- Refresh Token: Subject (sub), Expiration (7 days), Type ("refresh")

**Token Creation Process:**
1. Validate user credentials or verification code
2. Create token payload with user data and type indicator
3. Encode with HS256 algorithm using configured secret key
4. Set different expiration times for access and refresh tokens

**Token Validation:**
- Decode JWT using configured secret key
- Verify algorithm matches configuration
- Check expiration timestamp
- Validate token type (access vs refresh)
- Load user from database using user ID

**Section sources**
- [auth_service.py:342](file://backend/app/services/auth_service.py#L342-L353)
- [security.py:48](file://backend/app/core/security.py#L48-L66)
- [security.py:68](file://backend/app/core/security.py#L68-L87)
- [config.py:28](file://backend/app/core/config.py#L28-L37)

## Performance Considerations
The authentication system implements several performance optimizations with cookie-based session management:

### Rate Limiting
- Sliding window algorithm for precise rate control
- Memory-based storage suitable for single-instance deployments
- Different thresholds for verification codes vs authentication attempts
- Automatic cleanup of expired rate limit entries

### Database Optimization
- Proper indexing on email fields for quick lookups
- Efficient query patterns using SQLAlchemy ORM
- Transaction management to prevent race conditions
- Verification code deduplication and cleanup

### Email Delivery
- Asynchronous SMTP support with fallback to synchronous
- Connection pooling and efficient resource management
- Retry mechanisms for failed deliveries

### Token Management
- Lightweight JWT tokens with minimal payload
- Efficient token validation without database queries
- Configurable expiration times for optimal security/performance balance
- Automatic refresh reduces token expiration overhead

### Cookie Management
- httpOnly cookies prevent XSS attacks
- Automatic cookie handling reduces client-side complexity
- Seamless integration with existing API patterns

## Troubleshooting Guide

### Common Authentication Issues

**Cookie Problems:**
- **Issue**: Cookies not being sent with requests
  - **Cause**: Browser security settings or CORS configuration
  - **Solution**: Check SameSite settings, ensure proper CORS configuration, verify cookie domain/path settings

**Rate Limit Exceeded:**
- **Issue**: Receiving 429 Too Many Requests
  - **Cause**: Too many verification code requests within sliding window period
  - **Solution**: Wait for rate limit to reset or reduce request frequency

**Expired Verification Codes:**
- **Issue**: Code validation fails with "expired" message
  - **Cause**: Code exceeded 5-minute validity period
  - **Solution**: Request a new verification code

**Invalid Credentials:**
- **Issue**: Login fails with invalid credentials
  - **Cause**: Wrong email/password combination or disabled user account
  - **Solution**: Verify credentials or contact support

**Token Validation Errors:**
- **Issue**: 401 Unauthorized on protected endpoints
  - **Cause**: Invalid, expired, or malformed JWT token
  - **Solution**: Re-authenticate to obtain new token

**Refresh Token Issues:**
- **Issue**: Automatic refresh fails silently
  - **Cause**: Expired refresh token or user deactivation
  - **Solution**: Force re-login to obtain new refresh token

### Client Integration Examples

**Frontend SDK Usage:**
The frontend provides a comprehensive authentication service with TypeScript interfaces and automatic cookie handling:

```typescript
// Example: Complete registration flow with cookie-based auth
const registerUser = async (email: string, password: string) => {
  // Step 1: Send verification code
  await authService.sendRegisterCode(email);
  
  // Step 2: Verify code (client receives code via email)
  const verificationResult = await authService.verifyRegisterCode({
    email,
    code: receivedCode,
    type: 'register'
  });
  
  // Step 3: Complete registration (cookies handled automatically)
  const loginResult = await authService.register({
    email,
    password,
    code: receivedCode,
    username: displayName
  });
  
  // Cookies automatically stored in browser
  // Subsequent requests include authentication automatically
  return loginResult.user;
};

// Example: Automatic refresh flow
const handle401Error = async (error: any) => {
  if (error.response?.status === 401) {
    try {
      // Attempt automatic refresh
      await authService.refreshAccessToken();
      // Retry original request
      return retryOriginalRequest();
    } catch {
      // Refresh failed, force login
      redirectToLogin();
    }
  }
};
```

**Curl Examples:**

```bash
# Send registration code
curl -X POST "http://localhost:8000/api/v1/auth/register/send-code" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","type":"register"}'

# Verify registration code
curl -X POST "http://localhost:8000/api/v1/auth/register/verify" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456","type":"register"}'

# Complete registration (returns cookies automatically)
curl -X POST "http://localhost:8000/api/v1/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword","code":"123456"}'

# Login with verification code (returns cookies automatically)
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","code":"123456"}'

# Login with password (returns cookies automatically)
curl -X POST "http://localhost:8000/api/v1/auth/login/password" \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"securepassword"}'

# Get current user info (uses cookies automatically)
curl -X GET "http://localhost:8000/api/v1/auth/me"

# Manual refresh (uses refresh cookie)
curl -X POST "http://localhost:8000/api/v1/auth/refresh"

# Logout (clears cookies)
curl -X POST "http://localhost:8000/api/v1/auth/logout"
```

**Section sources**
- [auth.service.ts:11](file://frontend/src/services/auth.service.ts#L11-L99)
- [auth.ts:3](file://frontend/src/types/auth.ts#L3-L45)

## Conclusion
The authentication system provides a comprehensive, secure, and user-friendly authentication solution with cookie-based session management and dual-token authentication. The system has successfully migrated from token-based to cookie-based authentication with the following key features:

- **Cookie-Based Authentication**: Implements httpOnly cookies for enhanced security and seamless user experience
- **Dual-Token System**: Provides separate access and refresh tokens with different expiration policies
- **Automatic Refresh**: Seamless token renewal eliminates user interruption
- **Comprehensive Rate Limiting**: Sliding window protection against abuse and spam attacks
- **Robust Security**: Multi-layered security with token validation, rate limiting, and cookie management
- **Flexible Verification System**: Comprehensive verification code system with configurable expiration and rate limits
- **Developer-Friendly**: Well-documented APIs with clear request/response schemas and comprehensive error handling
- **Production Ready**: Includes proper database transactions, email delivery, and security best practices

The system balances security requirements with usability, providing multiple authentication pathways while maintaining strong security controls. The cookie-based approach eliminates the need for manual token management while providing enhanced protection against common security vulnerabilities. The dual-token system ensures long-term session stability while maintaining security through automatic refresh mechanisms. The comprehensive rate limiting implementation protects the system from abuse while maintaining good user experience.

The modular architecture allows for easy maintenance and extension of authentication features as requirements evolve, with clear separation of concerns between cookie management, token handling, rate limiting, and business logic.