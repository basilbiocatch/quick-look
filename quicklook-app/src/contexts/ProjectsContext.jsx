import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getProjects } from "../api/quicklookApi";

const ProjectsContext = createContext(null);

export function ProjectsProvider({ children }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    getProjects()
      .then((res) => {
        if (!cancelledRef.current && res.data?.data) setProjects(res.data.data);
      })
      .catch(() => {
        if (!cancelledRef.current) setProjects([]);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    getProjects()
      .then((res) => {
        if (!cancelledRef.current && res.data?.data) setProjects(res.data.data);
      })
      .catch(() => {
        if (!cancelledRef.current) setProjects([]);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
  }, []);

  const value = { projects, loading, refetch };

  return (
    <ProjectsContext.Provider value={value}>
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {
    throw new Error("useProjects must be used within a ProjectsProvider");
  }
  return ctx;
}
