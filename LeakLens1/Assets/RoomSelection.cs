using UnityEngine;
using UnityEngine.SceneManagement;

public class RoomSelection : MonoBehaviour
{
    public void LoadRoom(string roomName)
    {
        SceneManager.LoadScene(roomName);
    }
}