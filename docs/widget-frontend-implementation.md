# Widget Frontend Implementation

## Overview

✅ **To-Do #11: Widget Frontend - COMPLETED**

Widget Frontend has been fully implemented. This provides a complete React-based chat widget that can be embedded in WordPress sites.

## Components

### 1. Widget Loader (`public/widget/loader.js`)

**Purpose**: Vanilla JS loader script injected by WordPress plugin

**Features**:
- Checks for configuration (`AIWooChatConfig`)
- Creates widget container DOM element
- Loads widget bundle from SaaS API endpoint
- Prevents multiple initializations

**Usage**: WordPress plugin injects this script in footer

### 2. Storage Manager (`src/widget/storage.ts`)

**Purpose**: Manages visitor/conversation ID persistence

**Features**:
- Uses localStorage (fallback to sessionStorage)
- In-memory fallback if storage unavailable
- Methods: `getVisitorId()`, `setVisitorId()`, `getConversationId()`, `setConversationId()`
- Session data management: `getSessionData()`, `setSessionData()`

**Storage Keys**:
- `ai_woo_chat_visitor_id`
- `ai_woo_chat_conversation_id`

### 3. API Client (`src/widget/api-client.ts`)

**Purpose**: Handles all API communication with SaaS endpoints

**Methods**:
- `bootstrap()` - Initialize chat session
- `sendMessage()` - Send message and stream SSE response
- `trackEvent()` - Track user events (view, click, add_to_cart)

**Features**:
- Automatic Origin header injection
- SSE stream parsing
- Error handling
- Non-blocking event tracking

### 4. Main Widget Component (`src/widget/ChatWidget.tsx`)

**Purpose**: Main React component orchestrating the chat experience

**Features**:
- Session initialization on mount
- Message state management
- SSE streaming integration
- Product click/view tracking
- Welcome back detection

**State Management**:
- `isOpen` - Chat window visibility
- `messages` - Chat message history
- `isLoading` - Loading state
- `session` - Visitor/conversation IDs
- `inputValue` - Input field value

### 5. UI Components

#### ChatBubble (`src/widget/components/ChatBubble.tsx`)
- Fixed position floating button
- Bottom-right corner
- Gradient background
- Hover animations

#### ChatWindow (`src/widget/components/ChatWindow.tsx`)
- Modal chat interface
- Header with close button
- Message list container
- Input area

#### MessageList (`src/widget/components/MessageList.tsx`)
- Renders all messages
- Product card integration
- Intersection Observer for product view tracking
- Empty state handling

#### MessageItem (`src/widget/components/MessageItem.tsx`)
- Individual message rendering
- User vs assistant styling
- Streaming cursor animation
- Timestamp display

#### ProductCard (`src/widget/components/ProductCard.tsx`)
- Product recommendation display
- Price and stock status
- Click handling
- Hover effects

#### MessageInput (`src/widget/components/MessageInput.tsx`)
- Textarea input
- Send button
- Enter key handling (Shift+Enter for new line)
- Disabled state during loading

### 6. Widget Bundle Endpoint (`app/api/widget/route.ts`)

**Purpose**: Serves widget JavaScript bundle

**Features**:
- Dynamic React loading from CDN
- Widget initialization
- CORS headers for cross-origin loading
- Error handling

**Note**: In production, this should serve a pre-built bundle

## Integration Flow

1. **WordPress Plugin** injects loader script in footer
2. **Loader Script** creates container and loads widget bundle
3. **Widget Bundle** loads React from CDN and initializes widget
4. **ChatWidget** component bootstraps session
5. **Storage Manager** retrieves/stores visitor/conversation IDs
6. **API Client** communicates with SaaS endpoints
7. **UI Components** render chat interface

## API Integration

### Bootstrap Flow
1. Check localStorage for existing visitor/conversation IDs
2. Call `/api/chat/bootstrap` with IDs (if available)
3. Store returned IDs in localStorage
4. Show welcome message if returning visitor

### Message Flow
1. User types message and clicks send
2. Add user message to UI immediately
3. Create placeholder assistant message
4. Call `/api/chat/message` with SSE
5. Stream chunks and update assistant message
6. Stream products as they're verified
7. Mark message as complete when `done` event received

### Event Tracking
- **Product View**: Tracked via Intersection Observer when product card enters viewport
- **Product Click**: Tracked when user clicks product card
- **Add to Cart**: Can be tracked when user adds product (future enhancement)

## Styling

All components use CSS Modules for scoped styling:
- Responsive design (mobile-friendly)
- Modern gradient backgrounds
- Smooth animations and transitions
- Accessible color contrasts
- Hover states and interactions

## Storage Strategy

**Current**: localStorage (client-managed)
- Pros: Simple, no server cookies needed
- Cons: Can be cleared by user, not HTTP-only

**Future Enhancement**: HTTP-only cookies
- More secure
- Server-controlled
- Better for production

## Error Handling

- **Bootstrap failures**: Logged, widget doesn't initialize
- **Message failures**: Error message shown in chat
- **SSE stream errors**: Graceful degradation, partial messages saved
- **Event tracking failures**: Non-blocking, logged to console

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Requires ES6+ support
- Requires Fetch API
- Requires Intersection Observer API

## Performance Considerations

- React loaded from CDN (cached across sites)
- Widget bundle can be cached
- Lazy loading of React components
- Efficient SSE parsing
- Debounced product view tracking

## Security

- Origin header validation (handled by backend)
- CORS headers for cross-origin loading
- No sensitive data in localStorage
- XSS protection via React

## Future Enhancements

1. **HTTP-only cookies** for session management
2. **Pre-built bundle** instead of dynamic loading
3. **Service Worker** for offline support
4. **WebSocket** fallback for SSE
5. **Customizable themes** per site
6. **Multi-language support**
7. **Voice input** support
8. **File upload** support

## Testing Recommendations

1. Test widget loading on WordPress site
2. Test session persistence (localStorage)
3. Test SSE streaming (chunks, products, done)
4. Test error handling (network failures)
5. Test product click/view tracking
6. Test mobile responsiveness
7. Test multiple concurrent sessions
8. Test CORS validation
9. Test browser compatibility
10. Test performance with long conversations
