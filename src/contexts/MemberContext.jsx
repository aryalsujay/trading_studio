import { createContext, useState, useEffect, useContext } from 'react';

const MemberContext = createContext();

export function MemberProvider({ children }) {
    const [members, setMembers] = useState([]);
    const [selectedMember, setSelectedMember] = useState(null); // null = All Members
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchMembers();
    }, []);

    async function fetchMembers() {
        try {
            const response = await fetch('http://localhost:3000/api/members');
            if (response.ok) {
                const data = await response.json();
                setMembers(data);
                // If only one member exists, select them by default? 
                // Or maybe keep "All" as default. Let's keep "All" as default.
            }
        } catch (error) {
            console.error('Failed to fetch members:', error);
        } finally {
            setLoading(false);
        }
    }

    const value = {
        members,
        selectedMember,
        setSelectedMember,
        loading,
        refreshMembers: fetchMembers
    };

    return (
        <MemberContext.Provider value={value}>
            {children}
        </MemberContext.Provider>
    );
}

export function useMembers() {
    const context = useContext(MemberContext);
    if (!context) {
        throw new Error('useMembers must be used within a MemberProvider');
    }
    return context;
}
