declare global {
    namespace Express {
        interface Request {
            user?: {
                role?: 'member' | 'trainer' | 'admin'
            }
        }
    }
}

export {}