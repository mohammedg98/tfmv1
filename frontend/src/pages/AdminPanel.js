import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Trash2,
  Search,
  Users,
  Database,
  Box,
  Upload,
  Download,
  RefreshCw,
  Shield,
  CheckSquare,
  Square,
  LayoutDashboard,
  BookOpen,
  UserCog,
  HardDrive,
} from "lucide-react";
import "./AdminPanel.css";
import { backendUrl } from "../config";

const PAGE_SIZE = 50;
const DATASET_ID_SEP = "::";

function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatScore(value) {
  if (value == null || value === "") return "N/A";
  const n = Number(value);
  if (Number.isNaN(n)) return "N/A";
  return n.toFixed(3);
}

function AdminPanel() {
  const [activeTab, setActiveTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [models, setModels] = useState([]);
  const [platformStats, setPlatformStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [selectedItems, setSelectedItems] = useState({
    users: new Set(),
    datasets: new Set(),
    models: new Set(),
  });
  const [refreshing, setRefreshing] = useState(false);
  const [infoDataset, setInfoDataset] = useState("");
  const [datasetInfoText, setDatasetInfoText] = useState("");
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoSaving, setInfoSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setPage(1);
    setSearchTerm("");
    setOwnerFilter("");
  }, [activeTab]);

  const redirectAway = () => {
    navigate("/login");
  };

  const checkAdminAccess = async () => {
    try {
      const adminCheck = await axios.get(`${backendUrl}/api/users/check-admin`, {
        withCredentials: true,
      });

      if (!adminCheck.data.is_admin) {
        alert("Administrator access required");
        redirectAway();
        return;
      }

      const userInfoResponse = await axios.get(
        `${backendUrl}/api/users/current-user3`,
        { withCredentials: true }
      );

      setUserInfo(userInfoResponse.data);
      loadData();
    } catch (error) {
      console.error("Admin access check failed:", error);
      redirectAway();
    }
  };

  const unwrapList = (data) => {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [usersResponse, datasetsResponse, modelsResponse, statsSettled] =
        await Promise.all([
          axios.get(`${backendUrl}/api/admin/users`, { withCredentials: true }),
          axios.get(`${backendUrl}/api/admin/datasets`, {
            withCredentials: true,
          }),
          axios.get(`${backendUrl}/api/admin/models`, {
            withCredentials: true,
          }),
          axios
            .get(`${backendUrl}/api/admin/platform-stats`, {
              withCredentials: true,
            })
            .catch((err) => {
              console.warn("platform-stats unavailable:", err);
              return null;
            }),
        ]);

      setUsers(unwrapList(usersResponse.data));
      setDatasets(unwrapList(datasetsResponse.data));
      setModels(unwrapList(modelsResponse.data));
      setPlatformStats(statsSettled?.data || null);

      setSelectedItems({
        users: new Set(),
        datasets: new Set(),
        models: new Set(),
      });
    } catch (error) {
      console.error("Error loading admin data:", error);
      if (error.response?.status === 403) {
        alert("Unauthorized access");
        redirectAway();
      } else {
        alert(
          `Error loading data: ${error.response?.data?.detail || error.message}`
        );
      }
    }
    setLoading(false);
    setRefreshing(false);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleUploadRedirect = () => {
    navigate("/upload");
  };

  const handleExportData = () => {
    const data = {
      users: filteredUsers,
      datasets: filteredDatasets,
      models: filteredModels,
      platformStats,
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `admin-export-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    alert("Data exported successfully!");
  };

  const getItemId = (item, tab = activeTab) => {
    switch (tab) {
      case "users":
        return item._id;
      case "datasets":
        return `${item.table_name}${DATASET_ID_SEP}${item.owner_id}`;
      case "models":
        return item.id;
      default:
        return null;
    }
  };

  const parseDatasetId = (compositeId) => {
    const idx = compositeId.indexOf(DATASET_ID_SEP);
    if (idx === -1) return { tableName: compositeId, ownerId: "" };
    return {
      tableName: compositeId.slice(0, idx),
      ownerId: compositeId.slice(idx + DATASET_ID_SEP.length),
    };
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.email?.toLowerCase().includes(q) ||
        user.name?.toLowerCase().includes(q)
    );
  }, [users, searchTerm]);

  const ownerOptions = useMemo(() => {
    const map = new Map();
    datasets.forEach((d) => {
      if (d.owner_id && !map.has(d.owner_id)) {
        map.set(d.owner_id, d.owner_email || d.owner_name || d.owner_id);
      }
    });
    return Array.from(map.entries()).sort((a, b) =>
      String(a[1]).localeCompare(String(b[1]))
    );
  }, [datasets]);

  const filteredDatasets = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return datasets.filter((dataset) => {
      if (ownerFilter && dataset.owner_id !== ownerFilter) return false;
      return (
        dataset.table_name?.toLowerCase().includes(q) ||
        dataset.owner_email?.toLowerCase().includes(q) ||
        dataset.owner_name?.toLowerCase().includes(q)
      );
    });
  }, [datasets, searchTerm, ownerFilter]);

  const filteredModels = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return models.filter(
      (model) =>
        model.model_name?.toLowerCase().includes(q) ||
        model.db_name?.toLowerCase().includes(q) ||
        model.user_email?.toLowerCase().includes(q) ||
        model.model_type?.toLowerCase().includes(q)
    );
  }, [models, searchTerm]);

  const getCurrentItems = () => {
    switch (activeTab) {
      case "users":
        return filteredUsers;
      case "datasets":
        return filteredDatasets;
      case "models":
        return filteredModels;
      default:
        return [];
    }
  };

  const paginatedItems = useMemo(() => {
    const items = getCurrentItems();
    const start = (page - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, filteredUsers, filteredDatasets, filteredModels, page]);

  const totalPages = Math.max(
    1,
    Math.ceil(getCurrentItems().length / PAGE_SIZE)
  );

  const selectableUsers = (list) => list.filter((u) => !u.is_admin);

  const toggleSelectAll = () => {
    const currentItems = getCurrentItems();
    const currentSelections = selectedItems[activeTab];

    if (activeTab === "users") {
      const eligible = selectableUsers(currentItems);
      const allSelected =
        eligible.length > 0 &&
        eligible.every((u) => currentSelections.has(u._id));
      setSelectedItems((prev) => ({
        ...prev,
        users: allSelected
          ? new Set()
          : new Set(eligible.map((u) => u._id)),
      }));
      return;
    }

    if (currentSelections.size === currentItems.length) {
      setSelectedItems((prev) => ({ ...prev, [activeTab]: new Set() }));
    } else {
      setSelectedItems((prev) => ({
        ...prev,
        [activeTab]: new Set(currentItems.map((item) => getItemId(item))),
      }));
    }
  };

  const toggleSelectItem = (itemId, item) => {
    if (activeTab === "users" && item?.is_admin) return;
    setSelectedItems((prev) => {
      const newSelection = new Set(prev[activeTab]);
      if (newSelection.has(itemId)) newSelection.delete(itemId);
      else newSelection.add(itemId);
      return { ...prev, [activeTab]: newSelection };
    });
  };

  const handleBulkDelete = async () => {
    const currentSelections = Array.from(selectedItems[activeTab]);
    if (currentSelections.length === 0) {
      alert("Please select items to delete");
      return;
    }

    const itemType = activeTab.slice(0, -1);
    if (
      !window.confirm(
        `Are you sure you want to delete ${currentSelections.length} ${itemType}(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      switch (activeTab) {
        case "users":
          await Promise.all(
            currentSelections.map((id) =>
              axios.delete(`${backendUrl}/api/admin/users/${id}`, {
                withCredentials: true,
              })
            )
          );
          break;
        case "datasets":
          await Promise.all(
            currentSelections.map((compositeId) => {
              const { tableName, ownerId } = parseDatasetId(compositeId);
              return axios.delete(`${backendUrl}/api/admin/datasets`, {
                data: { datasetName: tableName, ownerId },
                withCredentials: true,
              });
            })
          );
          break;
        case "models":
          await Promise.all(
            currentSelections.map((id) =>
              axios.delete(`${backendUrl}/api/admin/models`, {
                data: { modelId: id },
                withCredentials: true,
              })
            )
          );
          break;
        default:
          break;
      }

      alert(`${currentSelections.length} ${itemType}(s) deleted successfully`);
      loadData();
    } catch (error) {
      console.error(`Error bulk deleting ${activeTab}:`, error);
      alert(
        error.response?.data?.detail || `Error deleting ${itemType}(s)`
      );
    }
  };

  const deleteUser = async (userId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this user? All their data will be deleted."
      )
    ) {
      return;
    }
    try {
      await axios.delete(`${backendUrl}/api/admin/users/${userId}`, {
        withCredentials: true,
      });
      alert("User deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting user:", error);
      alert(error.response?.data?.detail || "Error deleting user");
    }
  };

  const toggleAdminRole = async (user) => {
    const makeAdmin = !user.is_admin;
    const label = makeAdmin ? "promote to admin" : "demote from admin";
    if (!window.confirm(`Are you sure you want to ${label} ${user.email}?`)) {
      return;
    }
    try {
      await axios.patch(
        `${backendUrl}/api/admin/users/${user._id}/role`,
        { is_admin: makeAdmin },
        { withCredentials: true }
      );
      alert(makeAdmin ? "User promoted to admin" : "User demoted");
      loadData();
    } catch (error) {
      console.error("Error updating role:", error);
      alert(error.response?.data?.detail || "Error updating user role");
    }
  };

  const deleteDataset = async (datasetName, ownerId) => {
    if (
      !window.confirm(
        `Are you sure you want to delete the dataset "${datasetName}"?`
      )
    ) {
      return;
    }
    try {
      await axios.delete(`${backendUrl}/api/admin/datasets`, {
        data: { datasetName, ownerId },
        withCredentials: true,
      });
      alert("Dataset deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting dataset:", error);
      alert(error.response?.data?.detail || "Error deleting dataset");
    }
  };

  const deleteModel = async (modelId) => {
    if (!window.confirm("Are you sure you want to delete this model?")) {
      return;
    }
    try {
      await axios.delete(`${backendUrl}/api/admin/models`, {
        data: { modelId },
        withCredentials: true,
      });
      alert("Model deleted successfully");
      loadData();
    } catch (error) {
      console.error("Error deleting model:", error);
      alert(error.response?.data?.detail || "Error deleting model");
    }
  };

  const loadDatasetInfo = async (tableName) => {
    setInfoDataset(tableName);
    if (!tableName) {
      setDatasetInfoText("");
      return;
    }
    setInfoLoading(true);
    try {
      const res = await axios.get(
        `${backendUrl}/api/admin/dataset-info/${encodeURIComponent(tableName)}`,
        { withCredentials: true }
      );
      setDatasetInfoText(res.data?.dataset_info || "");
    } catch (error) {
      console.error("Error loading dataset info:", error);
      setDatasetInfoText("");
      alert(error.response?.data?.detail || "Error loading dataset info");
    }
    setInfoLoading(false);
  };

  const saveDatasetInfo = async () => {
    if (!infoDataset) return;
    setInfoSaving(true);
    try {
      await axios.post(
        `${backendUrl}/api/admin/dataset-info/${encodeURIComponent(infoDataset)}`,
        { dataset_info: datasetInfoText },
        { withCredentials: true }
      );
      alert("Dataset information saved");
      loadData();
    } catch (error) {
      console.error("Error saving dataset info:", error);
      alert(error.response?.data?.detail || "Error saving dataset info");
    }
    setInfoSaving(false);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown date";
    try {
      return new Date(dateString).toLocaleDateString("en-US");
    } catch {
      return "Invalid date";
    }
  };

  if (!userInfo) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner"></div>
        <p>Verifying access rights...</p>
      </div>
    );
  }

  const currentSelections = selectedItems[activeTab] || new Set();
  const currentItems = getCurrentItems();
  const allSelected =
    activeTab === "users"
      ? selectableUsers(currentItems).length > 0 &&
        selectableUsers(currentItems).every((u) =>
          currentSelections.has(u._id)
        )
      : currentItems.length > 0 &&
        currentSelections.size === currentItems.length;
  const someSelected = currentSelections.size > 0;
  const showListTools = ["users", "datasets", "models"].includes(activeTab);

  const maxTypeCount = Math.max(
    1,
    ...(platformStats?.model_type_breakdown || []).map((x) => x.count)
  );

  return (
    <div className="admin-panel">
      <header className="admin-header">
        <div className="admin-header-info">
          <div className="admin-title">
            <Shield className="admin-icon" size={32} />
            <h1>Administration Panel</h1>
          </div>
          <p className="admin-welcome">Connected as: {userInfo.email}</p>
          <p className="admin-welcome">
            Status: {userInfo.is_admin ? "Administrator" : "User"}
          </p>

          <div className="admin-stats">
            <div className="stat-item">
              <Users size={16} />
              <span>Users: {users.length}</span>
            </div>
            <div className="stat-item">
              <Database size={16} />
              <span>Datasets: {datasets.length}</span>
            </div>
            <div className="stat-item">
              <Box size={16} />
              <span>Models: {models.length}</span>
            </div>
            {platformStats?.saved_models_disk_bytes != null && (
              <div className="stat-item">
                <HardDrive size={16} />
                <span>
                  Disk: {formatBytes(platformStats.saved_models_disk_bytes)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="admin-actions">
          <button onClick={handleUploadRedirect} className="upload-btn">
            <Upload size={16} />
            Upload a predefined dataset
          </button>
          <button onClick={handleExportData} className="export-btn">
            <Download size={16} />
            Export
          </button>
          <button
            onClick={handleRefresh}
            className="refresh-btn"
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? "spinning" : ""} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <div className="admin-content-area">
        <div className="admin-tabs">
          <button
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            <LayoutDashboard size={18} />
            Overview
          </button>
          <button
            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            <Users size={18} />
            Users
            <span className="tab-count">{users.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "datasets" ? "active" : ""}`}
            onClick={() => setActiveTab("datasets")}
          >
            <Database size={18} />
            Datasets
            <span className="tab-count">{datasets.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "models" ? "active" : ""}`}
            onClick={() => setActiveTab("models")}
          >
            <Box size={18} />
            Models
            <span className="tab-count">{models.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === "dataset-info" ? "active" : ""}`}
            onClick={() => setActiveTab("dataset-info")}
          >
            <BookOpen size={18} />
            Dataset info
          </button>
        </div>

        {showListTools && (
          <div className="search-section">
            <div className="search-bar">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="search-input"
              />
              {searchTerm && (
                <button
                  className="clear-search"
                  onClick={() => setSearchTerm("")}
                >
                  ×
                </button>
              )}
            </div>
            {activeTab === "datasets" && (
              <select
                className="admin-owner-filter"
                value={ownerFilter}
                onChange={(e) => {
                  setOwnerFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All owners</option>
                {ownerOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            )}
            <div className="results-info">
              Showing {paginatedItems.length} of {currentItems.length}{" "}
              {activeTab}
              {totalPages > 1 ? ` · page ${page}/${totalPages}` : ""}
            </div>
          </div>
        )}

        {showListTools && someSelected && (
          <div className="bulk-actions">
            <div className="bulk-info">
              {currentSelections.size} selected
            </div>
            <button onClick={handleBulkDelete} className="bulk-delete-btn">
              <Trash2 size={16} />
              Delete Selected
            </button>
          </div>
        )}

        <div className="admin-content">
          {loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading data...</p>
            </div>
          ) : (
            <div className="table-section">
              {activeTab === "overview" && (
                <>
                  <div className="table-header">
                    <h3>Platform overview</h3>
                    <p>Global usage KPIs for supervision</p>
                  </div>
                  <div className="overview-kpi-grid">
                    <div className="overview-kpi">
                      <span className="overview-kpi-label">Users</span>
                      <span className="overview-kpi-value">
                        {platformStats?.total_users ?? users.length}
                      </span>
                      <span className="overview-kpi-sub">
                        {platformStats?.total_admins ?? "N/A"} admins ·{" "}
                        {platformStats?.users_registered_last_7_days ?? "N/A"} new
                        (7d)
                      </span>
                    </div>
                    <div className="overview-kpi">
                      <span className="overview-kpi-label">Datasets</span>
                      <span className="overview-kpi-value">
                        {platformStats?.total_datasets ?? datasets.length}
                      </span>
                    </div>
                    <div className="overview-kpi">
                      <span className="overview-kpi-label">Models</span>
                      <span className="overview-kpi-value">
                        {platformStats?.total_models ?? models.length}
                      </span>
                    </div>
                    <div className="overview-kpi">
                      <span className="overview-kpi-label">
                        Models disk usage
                      </span>
                      <span className="overview-kpi-value">
                        {formatBytes(platformStats?.saved_models_disk_bytes)}
                      </span>
                    </div>
                  </div>

                  <div className="overview-charts">
                    <div className="overview-chart-card">
                      <h4>Model types</h4>
                      {(platformStats?.model_type_breakdown || []).length ===
                      0 ? (
                        <p className="overview-empty">No models yet</p>
                      ) : (
                        <ul className="overview-bar-list">
                          {platformStats.model_type_breakdown.map((row) => (
                            <li key={row.model_type}>
                              <div className="overview-bar-meta">
                                <span>{row.model_type}</span>
                                <span>{row.count}</span>
                              </div>
                              <div className="overview-bar-track">
                                <div
                                  className="overview-bar-fill"
                                  style={{
                                    width: `${(row.count / maxTypeCount) * 100}%`,
                                  }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="overview-chart-card">
                      <h4>Frameworks</h4>
                      {(platformStats?.framework_breakdown || []).length ===
                      0 ? (
                        <p className="overview-empty">No models yet</p>
                      ) : (
                        <ul className="overview-bar-list">
                          {platformStats.framework_breakdown.map((row) => (
                            <li key={row.framework}>
                              <div className="overview-bar-meta">
                                <span>{row.framework}</span>
                                <span>{row.count}</span>
                              </div>
                              <div className="overview-bar-track">
                                <div
                                  className="overview-bar-fill framework"
                                  style={{
                                    width: `${
                                      (row.count /
                                        Math.max(
                                          1,
                                          ...platformStats.framework_breakdown.map(
                                            (x) => x.count
                                          )
                                        )) *
                                      100
                                    }%`,
                                  }}
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === "users" && (
                <>
                  <div className="table-header">
                    <h3>Users Management</h3>
                    <p>Manage accounts, roles, and resource usage</p>
                  </div>
                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <button
                              className="select-all-btn"
                              onClick={toggleSelectAll}
                              title={
                                allSelected ? "Deselect all" : "Select all"
                              }
                            >
                              {allSelected ? (
                                <CheckSquare size={16} />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </th>
                          <th>ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Admin</th>
                          <th>Datasets</th>
                          <th>Models</th>
                          <th>Registration</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((user) => (
                          <tr key={user._id} className="table-row">
                            <td>
                              <input
                                type="checkbox"
                                checked={currentSelections.has(user._id)}
                                onChange={() =>
                                  toggleSelectItem(user._id, user)
                                }
                                disabled={user.is_admin}
                                className="row-checkbox"
                              />
                            </td>
                            <td className="user-id">
                              {user._id?.slice(-8)}
                            </td>
                            <td className="user-name">
                              {user.name || "Not specified"}
                            </td>
                            <td className="user-email">{user.email}</td>
                            <td>
                              <span
                                className={`admin-badge ${
                                  user.is_admin ? "admin" : "user"
                                }`}
                              >
                                {user.is_admin ? "Admin" : "User"}
                              </span>
                            </td>
                            <td>{user.dataset_count ?? 0}</td>
                            <td>{user.model_count ?? 0}</td>
                            <td className="user-date">
                              {formatDate(user.created_at || user.createdAt)}
                            </td>
                            <td className="actions-cell">
                              <button
                                onClick={() => toggleAdminRole(user)}
                                className="role-btn"
                                title={
                                  user.is_admin
                                    ? "Demote admin"
                                    : "Promote to admin"
                                }
                                disabled={
                                  user._id === userInfo.user_id
                                }
                              >
                                <UserCog size={14} />
                                {user.is_admin ? "Demote" : "Promote"}
                              </button>
                              <button
                                onClick={() => deleteUser(user._id)}
                                className="delete-btn"
                                title="Delete user"
                                disabled={user.is_admin}
                              >
                                <Trash2 size={14} />
                                {user.is_admin ? "Protected" : "Delete"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                      <div className="no-data">
                        <Users size={48} />
                        <p>No users found</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "datasets" && (
                <>
                  <div className="table-header">
                    <h3>Datasets Management</h3>
                    <p>Monitor datasets across all owners</p>
                  </div>
                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <button
                              className="select-all-btn"
                              onClick={toggleSelectAll}
                            >
                              {allSelected ? (
                                <CheckSquare size={16} />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </th>
                          <th>Table Name</th>
                          <th>Owner</th>
                          <th>Email</th>
                          <th>Info</th>
                          <th>Creation Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((dataset) => {
                          const itemId = getItemId(dataset, "datasets");
                          return (
                            <tr key={itemId} className="table-row">
                              <td>
                                <input
                                  type="checkbox"
                                  checked={currentSelections.has(itemId)}
                                  onChange={() => toggleSelectItem(itemId)}
                                  className="row-checkbox"
                                />
                              </td>
                              <td className="dataset-name">
                                {dataset.table_name}
                              </td>
                              <td>{dataset.owner_name || "Unknown user"}</td>
                              <td className="owner-email">
                                {dataset.owner_email || "Unknown email"}
                              </td>
                              <td>
                                <span
                                  className={`info-badge ${
                                    dataset.has_dataset_info ? "yes" : "no"
                                  }`}
                                >
                                  {dataset.has_dataset_info ? "Yes" : "No"}
                                </span>
                              </td>
                              <td className="dataset-date">
                                {formatDate(dataset.created_at)}
                              </td>
                              <td className="actions-cell">
                                <button
                                  onClick={() => {
                                    setActiveTab("dataset-info");
                                    loadDatasetInfo(dataset.table_name);
                                  }}
                                  className="role-btn"
                                  title="Edit pedagogical info"
                                >
                                  <BookOpen size={14} />
                                  Info
                                </button>
                                <button
                                  onClick={() =>
                                    deleteDataset(
                                      dataset.table_name,
                                      dataset.owner_id
                                    )
                                  }
                                  className="delete-btn"
                                  title="Delete dataset"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredDatasets.length === 0 && (
                      <div className="no-data">
                        <Database size={48} />
                        <p>No datasets found</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "models" && (
                <>
                  <div className="table-header">
                    <h3>Models Management</h3>
                    <p>Identify heavy models and clean unused ones</p>
                  </div>
                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th style={{ width: "40px" }}>
                            <button
                              className="select-all-btn"
                              onClick={toggleSelectAll}
                            >
                              {allSelected ? (
                                <CheckSquare size={16} />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          </th>
                          <th>Model Name</th>
                          <th>Dataset</th>
                          <th>Owner</th>
                          <th>Type</th>
                          <th>Framework</th>
                          <th>Score</th>
                          <th>Size</th>
                          <th>Creation Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedItems.map((model) => {
                          const score =
                            model.accuracy_score ??
                            model.r2_score ??
                            model.silhouette_score;
                          return (
                            <tr key={model.id} className="table-row">
                              <td>
                                <input
                                  type="checkbox"
                                  checked={currentSelections.has(model.id)}
                                  onChange={() => toggleSelectItem(model.id)}
                                  className="row-checkbox"
                                />
                              </td>
                              <td className="model-name">
                                {model.model_name}
                              </td>
                              <td>{model.db_name}</td>
                              <td className="model-owner">
                                {model.user_email || "Unknown user"}
                              </td>
                              <td>
                                <span
                                  className={`type-badge ${
                                    model.model_type?.toLowerCase() ||
                                    "unknown"
                                  }`}
                                >
                                  {model.model_type || "Unknown"}
                                </span>
                              </td>
                              <td>
                                <span className="framework-badge">
                                  {model.framework || "Unknown"}
                                </span>
                              </td>
                              <td>{formatScore(score)}</td>
                              <td>{formatBytes(model.file_size_bytes)}</td>
                              <td className="model-date">
                                {formatDate(model.created_at)}
                              </td>
                              <td className="actions-cell">
                                <button
                                  onClick={() => deleteModel(model.id)}
                                  className="delete-btn"
                                  title="Delete model"
                                >
                                  <Trash2 size={14} />
                                  Delete
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {filteredModels.length === 0 && (
                      <div className="no-data">
                        <Box size={48} />
                        <p>No models found</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "dataset-info" && (
                <>
                  <div className="table-header">
                    <h3>Pedagogical dataset info</h3>
                    <p>
                      Edit descriptions shown to users for predefined / shared
                      datasets
                    </p>
                  </div>
                  <div className="dataset-info-editor">
                    <label className="dataset-info-label">
                      Dataset
                      <select
                        value={infoDataset}
                        onChange={(e) => loadDatasetInfo(e.target.value)}
                        className="admin-owner-filter dataset-info-select"
                      >
                        <option value="">Select a dataset…</option>
                        {datasets.map((d) => (
                          <option
                            key={`${d.table_name}${DATASET_ID_SEP}${d.owner_id}`}
                            value={d.table_name}
                          >
                            {d.table_name}
                            {d.has_dataset_info ? " · has info" : ""}{" "}
                            {d.owner_email || d.owner_id}
                          </option>
                        ))}
                      </select>
                    </label>
                    {infoLoading ? (
                      <p>Loading…</p>
                    ) : (
                      <>
                        <textarea
                          className="dataset-info-textarea"
                          rows={14}
                          placeholder="Pedagogical description for this dataset…"
                          value={datasetInfoText}
                          onChange={(e) => setDatasetInfoText(e.target.value)}
                          disabled={!infoDataset}
                        />
                        <button
                          className="upload-btn"
                          onClick={saveDatasetInfo}
                          disabled={!infoDataset || infoSaving}
                        >
                          {infoSaving ? "Saving…" : "Save dataset info"}
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}

              {showListTools && totalPages > 1 && (
                <div className="admin-pagination">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </button>
                  <span>
                    Page {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;
