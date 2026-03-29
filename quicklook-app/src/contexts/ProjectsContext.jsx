import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { getProjects } from "../api/quicklookApi";

const ProjectsContext = createContext(null);

/**
 * Role for the current user on a project (from GET /projects).
 * @returns {{ role: "owner" | "editor" | "viewer" | null, loading: boolean }}
 */
export function useProjectRole(projectKey) {
  const ctx = useContext(ProjectsContext);
  if (!ctx) {
    return { role: null, loading: false };
  }
  const { projects, loading } = ctx;
  if (!projectKey) return { role: null, loading };
  const p = projects.find((x) => x.projectKey === projectKey);
  return { role: p?.role ?? null, loading };
}

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
