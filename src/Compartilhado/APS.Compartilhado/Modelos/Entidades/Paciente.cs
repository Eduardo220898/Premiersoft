using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace APS.Compartilhado.Modelos.Entidades;

/// <summary>
/// Entidade que representa um paciente
/// </summary>
public class Paciente
{
    [Key]
    public int Id { get; set; }
    
    [Required]
    [StringLength(100)]
    public string Nome { get; set; } = string.Empty;
    
    [Required]
    [StringLength(15)]
    public string CPF { get; set; } = string.Empty;
    
    [StringLength(20)]
    public string? RG { get; set; }
    
    [StringLength(20)]
    public string? CartaoSUS { get; set; }
    
    public DateTime DataNascimento { get; set; }
    
    [Required]
    [StringLength(1)]
    public string Sexo { get; set; } = string.Empty; // M ou F
    
    [StringLength(100)]
    public string? Email { get; set; }
    
    [StringLength(20)]
    public string? Telefone { get; set; }
    
    [Required]
    [StringLength(300)]
    public string Endereco { get; set; } = string.Empty;
    
    [StringLength(10)]
    public string? CEP { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Latitude { get; set; }
    
    [Column(TypeName = "decimal(10,7)")]
    public decimal? Longitude { get; set; }
    
    [StringLength(50)]
    public string? TipoSanguineo { get; set; }
    
    [StringLength(50)]
    public string EstadoCivil { get; set; } = "Não Informado";
    
    [StringLength(100)]
    public string? Profissao { get; set; }
    
    public bool Ativo { get; set; } = true;
    
    public DateTime DataCriacao { get; set; } = DateTime.UtcNow;
    
    public DateTime? DataAtualizacao { get; set; }
    
    // Informações de internação/atendimento
    public DateTime? DataInternacao { get; set; }
    
    public DateTime? DataAlta { get; set; }
    
    [StringLength(50)]
    public string StatusAtendimento { get; set; } = "Aguardando"; // Aguardando, Em Atendimento, Alta, Transferido
    
    [StringLength(50)]
    public string PrioridadeAtendimento { get; set; } = "Normal"; // Emergência, Urgente, Normal, Baixa
    
    // Chaves estrangeiras
    [Required]
    public int MunicipioId { get; set; }
    
    public int? HospitalAtualId { get; set; }
    
    // Relacionamentos
    [ForeignKey("MunicipioId")]
    public virtual Municipio Municipio { get; set; } = null!;
    
    [ForeignKey("HospitalAtualId")]
    public virtual Hospital? HospitalAtual { get; set; }
    
    public virtual ICollection<DiagnosticoPaciente> Diagnosticos { get; set; } = new List<DiagnosticoPaciente>();
}
